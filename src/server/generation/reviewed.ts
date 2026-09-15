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
import { isProviderRefusal } from "./refusal";

// Ignore incidental annotations inside a finding; only these required,
// validated fields can affect publication or repair. The verdict stays strict.
// The field label is advisory: a reviewer that writes "cards" or another
// wrong name still has its finding kept when the quote locates exactly one
// field. The repair schema stays strict, since it writes into named fields.
const issueSchema = z.object({ field: z.string().trim().min(1).max(40), quote: z.string().min(1).max(900), reason: z.string().trim().min(1).max(1500) });
const reviewSchema = z.strictObject({ decision: z.enum(["pass", "revise"]), issues: z.array(issueSchema).max(12) })
  .refine((r) => (r.decision === "pass") === (r.issues.length === 0));
const repairSchema = z.strictObject({ edits: z.array(z.strictObject({ field: z.string().trim().min(1).max(40), replacement: z.string().max(900).nullable() })).min(1).max(6) });

/** Internal trace for eval diagnostics. Never expose or log the draft/review text in production. */
export interface GroundingTrace<T = InterpretationOutput> {
  draft?: T;
  repaired?: T;
  repairAttempted: boolean;
  calls: { phase: "write" | "review" | "repair"; ms: number; model?: string; reason?: string; usage?: TokenUsage }[];
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
        else result[field as "perspective" | "reflection"] = replacement;
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
  const index = (field: string) => (field === "paragraph_1" ? 0 : field === "paragraph_2" ? 1 : field === "paragraph_3" ? 2 : -1);
  return {
    fields: FOLLOWUP_FIELDS,
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

export function parseReviewFor<T>(shape: AnswerShape<T>, raw: unknown, answer: T): GroundingReview | undefined {
  const result = reviewSchema.safeParse(raw);
  if (!result.success) return;
  // Require an actual quote. If the model mislabels its field, a unique
  // exact match can locate it without guessing or discarding the finding.
  const issues: GroundingIssue[] = [];
  for (const issue of result.data.issues) {
    const named = shape.fields.includes(issue.field) ? issue.field : undefined;
    if (named && shape.fieldText(answer, named)?.includes(issue.quote)) issues.push({ ...issue, field: named as GroundingIssue["field"] });
    else {
      const matches = shape.fields.filter((field) => shape.fieldText(answer, field)?.includes(issue.quote));
      if (matches.length !== 1) return;
      issues.push({ ...issue, field: matches[0] as GroundingIssue["field"] });
    }
  }
  return { ...result.data, issues };
}

export function applyRepairFor<T>(shape: AnswerShape<T>, raw: unknown, answer: T, review: GroundingReview): T | undefined {
  const parsed = repairSchema.safeParse(raw);
  if (!parsed.success) return;
  const allowed = new Set<string>(review.issues.map((i) => i.field));
  const fields = new Set(parsed.data.edits.map((e) => e.field));
  if (fields.size !== parsed.data.edits.length || fields.size !== allowed.size || [...fields].some((f) => !allowed.has(f))) return;
  let result: T | undefined = answer;
  for (const { field, replacement } of parsed.data.edits) {
    result = shape.applyEdit(result, field, replacement);
    if (!result) return;
  }
  return result;
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
  async function call(phase: "write" | "review" | "repair", fn: () => Promise<ProviderOutcome<unknown>>) {
    const started = Date.now();
    const result = await fn();
    quality.calls.push({ phase, ms: Date.now() - started, ...(result.ok ? { model: result.model, usage: result.usage } : { reason: result.reason }) });
    return result;
  }
  if (expired()) return fail("request_deadline");
  const written = await call("write", () => shape.write(provider, options));
  if (!written.ok) return { ...written, quality };
  if (expired()) return fail("request_deadline");
  const validated = shape.validate(written.value, drawnCardIds);
  if (!validated.ok) return { ok: false, reason: `output_invalid:${validated.reason}`, retryable: true, uncertain: false, quality };
  let answer = validated.output;
  let model = written.model;
  quality.draft = answer;

  for (let pass = 0; pass < 2; pass++) {
    if (expired()) return fail("request_deadline");
    const checked = await call("review", () => shape.review(provider, answer, options));
    if (!checked.ok) return fail(isProviderRefusal(checked.reason) ? checked.reason : `grounding_review:${checked.reason}`, checked.uncertain);
    if (expired()) return fail("request_deadline");
    const review = parseReviewFor(shape, checked.value, answer);
    if (!review) return fail("grounding_review_invalid");
    quality.reviews.push(review);
    if (review.decision === "pass") {
      const usages = quality.calls.flatMap((c) => (c.usage ? [c.usage] : []));
      const usage = usages.length ? usages.reduce((a, b) => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens }), { inputTokens: 0, outputTokens: 0 }) : undefined;
      return { ok: true, value: answer, model, usage, quality };
    }
    if (pass === 1) return fail("grounding_rejected");
    if (expired()) return fail("request_deadline");
    quality.repairAttempted = true;
    const repaired = await call("repair", () => shape.repair(provider, answer, review.issues, options));
    if (!repaired.ok) return fail(isProviderRefusal(repaired.reason) ? repaired.reason : `grounding_repair:${repaired.reason}`, repaired.uncertain);
    if (expired()) return fail("request_deadline");
    const patched = applyRepairFor(shape, repaired.value, answer, review);
    if (!patched) return fail("grounding_repair_invalid");
    const revalidated = shape.validate(patched, drawnCardIds);
    if (!revalidated.ok) return fail(`grounding_repair_invalid:${revalidated.reason}`);
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
