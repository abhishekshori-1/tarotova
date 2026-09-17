import { z } from "zod";
import { GENERATION_REQUEST_DEADLINE_MS } from "./config";
import {
  ANSWER_FIELDS,
  FOLLOWUP_FIELDS,
  type AnswerField,
  type FollowupField,
  type FollowupInput,
  type FollowupOutput,
  type GenerationProvider,
  type GroundingIssue,
  type GroundingReview,
  type InterpretationInput,
  type InterpretationOutput,
  type ProviderCallOptions,
  type ProviderOutcome,
  type TokenUsage,
} from "./types";
import { validateFollowup, validateInterpretation } from "./validate";
import { FOLLOWUP_LENGTHS, READING_LIMITS } from "./lengths";
import { isProviderRefusal } from "./refusal";
import { providerCalls, sumUsage } from "./usage";

// Ignore incidental annotations inside a finding; only these required,
// validated fields can affect publication or repair. The verdict stays strict.
// The field label is advisory: a reviewer that writes "cards" or another
// wrong name still has its finding kept when the quote locates exactly one
// field. The repair schema stays strict, since it writes into named fields.
const issueSchema = z.object({ field: z.string().trim().min(1).max(40), quote: z.string().min(1).max(900), reason: z.string().trim().min(1).max(1500) });
const reviewSchema = z.strictObject({ decision: z.enum(["pass", "revise"]), issues: z.array(issueSchema).max(12) })
  .refine((r) => (r.decision === "pass") === (r.issues.length === 0));
// A replacement is checked against its destination field's own limit (lengths.ts) in
// applyRepairDetailed; this schema only bounds the count and the largest field.
const LARGEST_FIELD = Math.max(READING_LIMITS.relevance.max, READING_LIMITS.perspective.max, FOLLOWUP_LENGTHS.paragraph.max);
const repairSchema = z.strictObject({ edits: z.array(z.strictObject({ field: z.string().trim().min(1).max(40), replacement: z.string().max(LARGEST_FIELD).nullable() })).min(1).max(Math.max(ANSWER_FIELDS.length, FOLLOWUP_FIELDS.length)) });

/** Internal trace for eval diagnostics. Never expose or log the draft/review text in production. */
export interface GroundingTrace<T = InterpretationOutput> {
  draft?: T;
  repaired?: T;
  repairAttempted: boolean;
  calls: { phase: "write" | "validate" | "review" | "repair"; ms: number; provider?: string; model?: string; reason?: string; detail?: string; usage?: TokenUsage }[];
  reviews: GroundingReview[];
}
export type ReviewedOutcome<T = InterpretationOutput> = ProviderOutcome<T> & { quality: GroundingTrace<T> };

/**
 * What the pipeline needs to know about an answer shape: its named fields,
 * how to read and replace one, how to validate the whole, and which
 * provider calls write, review and repair it. The reading and the follow-up
 * share every rule; only these differ.
 */
export interface AnswerShape<T> {
  fields: readonly string[];
  /** The character range a replacement for this field must fit; undefined for an unknown field. */
  fieldLimit(field: string): { min: number; max: number } | undefined;
  fieldText(answer: T, field: string): string | null;
  /** Returns undefined when the edit is structurally unsafe (null where text is required). */
  applyEdit(answer: T, field: string, replacement: string | null): T | undefined;
  validate(raw: unknown, drawnCardIds: string[]): { ok: true; output: T } | { ok: false; reason: string; detail?: string };
  write(provider: GenerationProvider, options: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  review(provider: GenerationProvider, answer: T, options: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  repair(provider: GenerationProvider, answer: T, issues: GroundingIssue[], options: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
}

export function readingShape(input: InterpretationInput): AnswerShape<InterpretationOutput> {
  return {
    fields: ANSWER_FIELDS,
    fieldLimit(field) {
      if (field === "situation" || field === "challenge" || field === "guidance") return READING_LIMITS.relevance;
      return READING_LIMITS[field as Exclude<AnswerField, "situation" | "challenge" | "guidance">];
    },
    fieldText(answer, field) {
      if (field === "situation" || field === "challenge" || field === "guidance") return answer.cards.find((c) => c.position === field)!.relevance;
      return answer[field as Exclude<AnswerField, "situation" | "challenge" | "guidance">];
    },
    applyEdit(answer, field, replacement) {
      const result = structuredClone(answer);
      if (field === "beyondSpread") result.beyondSpread = replacement;
      else {
        if (replacement === null) return undefined;
        if (field === "situation" || field === "challenge" || field === "guidance") result.cards.find((c) => c.position === field)!.relevance = replacement;
        else result[field as "perspective" | "synthesis" | "reflection"] = replacement;
      }
      return result;
    },
    validate: validateInterpretation,
    write: (p, o) => p.interpret(input, o),
    review: (p, a, o) => p.review(input, a, o),
    repair: (p, a, i, o) => p.repair(input, a, i, o),
  };
}

export function followupShape(input: FollowupInput): AnswerShape<FollowupOutput> {
  const index = (field: string) => { const m = /^paragraph_([1-5])$/.exec(field); return m ? Number(m[1]) - 1 : -1; };
  return {
    fields: FOLLOWUP_FIELDS,
    fieldLimit(field) {
      if (index(field) >= 0) return FOLLOWUP_LENGTHS.paragraph;
      if (field === "reflection" || field === "beyondSpread") return FOLLOWUP_LENGTHS[field];
      return undefined;
    },
    fieldText(answer, field) {
      const i = index(field);
      if (i >= 0) return answer.paragraphs[i] ?? null;
      if (field === "reflection" || field === "beyondSpread") return answer[field];
      return null;
    },
    applyEdit(answer, field, replacement) {
      const result = structuredClone(answer);
      const i = index(field);
      if (i >= 0) {
        if (replacement === null || answer.paragraphs[i] === undefined) return undefined;
        result.paragraphs[i] = replacement;
      } else if (field === "reflection" || field === "beyondSpread") result[field as FollowupField & ("reflection" | "beyondSpread")] = replacement;
      else return undefined;
      return result;
    },
    validate: validateFollowup,
    write: (p, o) => p.followup(input, o),
    review: (p, a, o) => p.reviewFollowup(input, a, o),
    repair: (p, a, i, o) => p.repairFollowup(input, a, i, o),
  };
}

export function parseReviewDetailed<T>(shape: AnswerShape<T>, raw: unknown, answer: T): { ok: true; review: GroundingReview } | { ok: false; detail: string } {
  const result = reviewSchema.safeParse(raw);
  if (!result.success) {
    // Codes and known schema paths only, never provider text or the question.
    const keys = new Set(["decision", "issues", "field", "quote", "reason"]);
    const detail = result.error.issues.map((i) => `${i.code}@${i.path.map((p) => typeof p === "number" || keys.has(String(p)) ? String(p) : "?").join(".") || "root"}`).join(", ");
    return { ok: false, detail: `review_shape: ${detail}` };
  }
  // Require an actual quote. If the model mislabels its field, a unique
  // exact match can locate it without guessing or discarding the finding.
  const issues: GroundingIssue[] = [];
  for (const [index, issue] of result.data.issues.entries()) {
    const named = shape.fields.includes(issue.field) ? issue.field : undefined;
    if (named && shape.fieldText(answer, named)?.includes(issue.quote)) issues.push({ ...issue, field: named as GroundingIssue["field"] });
    else {
      const matches = shape.fields.filter((field) => shape.fieldText(answer, field)?.includes(issue.quote));
      if (matches.length !== 1) return { ok: false, detail: `review_quote: issue ${index + 1} ${matches.length ? "matches multiple fields" : "does not match any field"}` };
      issues.push({ ...issue, field: matches[0] as GroundingIssue["field"] });
    }
  }
  return { ok: true, review: { ...result.data, issues } };
}

export function parseReviewFor<T>(shape: AnswerShape<T>, raw: unknown, answer: T): GroundingReview | undefined {
  const result = parseReviewDetailed(shape, raw, answer);
  return result.ok ? result.review : undefined;
}

/**
 * Applies a repair, or says why it cannot be: the shape did not parse, the
 * edited fields are not exactly the flagged ones, or an edit names a field
 * the answer does not have. The detail goes to the trace, not the reader.
 */
export function applyRepairDetailed<T>(shape: AnswerShape<T>, raw: unknown, answer: T, review: GroundingReview): { ok: true; value: T } | { ok: false; detail: string } {
  const parsed = repairSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, detail: `repair_shape: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}` };
  const allowed = new Set<string>(review.issues.map((i) => i.field));
  const fields = new Set(parsed.data.edits.map((e) => e.field));
  if (fields.size !== parsed.data.edits.length) return { ok: false, detail: `repair_fields: duplicate edits for ${[...fields].join(", ")}` };
  if (fields.size !== allowed.size || [...fields].some((f) => !allowed.has(f))) return { ok: false, detail: `repair_fields: edited ${[...fields].join(", ") || "nothing"}; flagged ${[...allowed].join(", ")}` };
  let result: T | undefined = answer;
  for (const { field, replacement } of parsed.data.edits) {
    // The destination field's own limit, not a universal cap: a longer card paragraph may be repaired at its full length.
    const limit = shape.fieldLimit(field);
    if (replacement !== null && limit && (replacement.trim().length < limit.min || replacement.trim().length > limit.max)) return { ok: false, detail: `repair_length: ${field} ${replacement.trim().length} outside ${limit.min}–${limit.max}` };
    result = shape.applyEdit(result, field, replacement);
    if (!result) return { ok: false, detail: `repair_edit: ${field} is not a field of this answer` };
  }
  return { ok: true, value: result };
}

export function applyRepairFor<T>(shape: AnswerShape<T>, raw: unknown, answer: T, review: GroundingReview): T | undefined {
  const applied = applyRepairDetailed(shape, raw, answer, review);
  return applied.ok ? applied.value : undefined;
}

/** Reading-shaped helpers kept for the existing tests and the eval harness. */
export function parseGroundingReview(raw: unknown, answer: InterpretationOutput): GroundingReview | undefined {
  return parseReviewFor(readingShape({} as InterpretationInput), raw, answer);
}
export function applyGroundingRepair(raw: unknown, answer: InterpretationOutput, review: GroundingReview): InterpretationOutput | undefined {
  return applyRepairFor(readingShape({} as InterpretationInput), raw, answer, review);
}

/**
 * Shared production/eval publication gate: write -> review -> at most one
 * repair -> fresh review of the whole repaired answer. No candidate is
 * returned as a success without approval and structural validation.
 */
export async function runReviewed<T>(shape: AnswerShape<T>, provider: GenerationProvider, drawnCardIds: string[], options: ProviderCallOptions): Promise<ReviewedOutcome<T>> {
  const quality: GroundingTrace<T> = { repairAttempted: false, calls: [], reviews: [] };
  const expired = () => Date.now() >= options.deadlineAt;
  const fail = (reason: string, uncertain = false): ReviewedOutcome<T> => ({ ok: false, reason, retryable: false, uncertain, quality });
  // At most one transport retry across both review phases. Retain the same
  // candidate and deadline, and count both calls. A returned verdict, invalid
  // review, refusal or configuration error never buys another judgement.
  let reviewTransportRetried = false;
  async function call(phase: "write" | "review" | "repair", fn: () => Promise<ProviderOutcome<unknown>>) {
    const started = Date.now();
    const result = await fn();
    quality.calls.push(...providerCalls(result, Date.now() - started).map((c) => ({ phase, ...c })));
    return result;
  }
  if (expired()) return fail("request_deadline");
  const written = await call("write", () => shape.write(provider, options));
  if (!written.ok) return { ...written, quality };
  if (expired()) return fail("request_deadline");
  const validated = shape.validate(written.value, drawnCardIds);
  if (!validated.ok) {
    // Keep the validator's detail in the trace so an eval report says which limit the draft broke.
    quality.calls.push({ phase: "validate", ms: 0, reason: `draft_validate: ${validated.reason}${validated.detail ? `: ${validated.detail}` : ""}` });
    return { ok: false, reason: `output_invalid:${validated.reason}`, retryable: true, uncertain: false, quality };
  }
  let answer = validated.output;
  let model = written.model;
  quality.draft = answer;

  for (let pass = 0; pass < 2; pass++) {
    if (expired()) return fail("request_deadline");
    let checked = await call("review", () => shape.review(provider, answer, options));
    if (!checked.ok && checked.retryable && /^(provider_network|provider_timeout|provider_http_(429|5\d\d))$/.test(checked.reason) && !reviewTransportRetried && options.deadlineAt - Date.now() >= 5_000) {
      reviewTransportRetried = true;
      checked = await call("review", () => shape.review(provider, answer, options));
    }
    if (!checked.ok) return fail(isProviderRefusal(checked.reason) ? checked.reason : `grounding_review:${checked.reason}`, checked.uncertain);
    if (expired()) return fail("request_deadline");
    const parsed = parseReviewDetailed(shape, checked.value, answer);
    if (!parsed.ok) {
      quality.calls.push({ phase: "validate", ms: 0, reason: parsed.detail });
      return fail("grounding_review_invalid");
    }
    const review = parsed.review;
    quality.reviews.push(review);
    if (review.decision === "pass") {
      const usages = quality.calls.flatMap((c) => (c.usage ? [c.usage] : []));
      const usage = usages.length ? sumUsage(usages) : undefined;
      return { ok: true, value: answer, model, usage, quality };
    }
    if (pass === 1) return fail("grounding_rejected");
    if (expired()) return fail("request_deadline");
    quality.repairAttempted = true;
    const repaired = await call("repair", () => shape.repair(provider, answer, review.issues, options));
    if (!repaired.ok) return fail(isProviderRefusal(repaired.reason) ? repaired.reason : `grounding_repair:${repaired.reason}`, repaired.uncertain);
    if (expired()) return fail("request_deadline");
    const patched = applyRepairDetailed(shape, repaired.value, answer, review);
    if (!patched.ok) {
      quality.calls.push({ phase: "validate", ms: 0, reason: patched.detail });
      return fail("grounding_repair_invalid");
    }
    const revalidated = shape.validate(patched.value, drawnCardIds);
    if (!revalidated.ok) {
      quality.calls.push({ phase: "validate", ms: 0, reason: `repair_validate: ${revalidated.reason}${revalidated.detail ? `: ${revalidated.detail}` : ""}` });
      return fail(`grounding_repair_invalid:${revalidated.reason}`);
    }
    answer = revalidated.output;
    model = repaired.model;
    quality.repaired = answer;
  }
  return fail("grounding_rejected");
}

export function generateReviewed(provider: GenerationProvider, input: InterpretationInput, drawnCardIds: string[], options: ProviderCallOptions = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS }): Promise<ReviewedOutcome<InterpretationOutput>> {
  return runReviewed(readingShape(input), provider, drawnCardIds, options);
}

export function generateReviewedFollowup(provider: GenerationProvider, input: FollowupInput, drawnCardIds: string[], options: ProviderCallOptions = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS }): Promise<ReviewedOutcome<FollowupOutput>> {
  return runReviewed(followupShape(input), provider, drawnCardIds, options);
}
