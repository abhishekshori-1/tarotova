import { z } from "zod";
import { GENERATION_REQUEST_DEADLINE_MS } from "./config";
import { ANSWER_FIELDS, type AnswerField, type GenerationProvider, type GroundingIssue, type GroundingReview, type InterpretationInput, type InterpretationOutput, type ProviderCallOptions, type ProviderOutcome } from "./types";
import { validateInterpretation } from "./validate";
import { isProviderRefusal } from "./refusal";

// Ignore incidental annotations inside a finding; only these required,
// validated fields can affect publication or repair. The verdict stays strict.
// The field label is advisory: a reviewer that writes "cards" or another
// wrong name still has its finding kept when the quote locates exactly one
// field. The repair schema stays strict, since it writes into named fields.
const issueSchema = z.object({ field: z.string().trim().min(1).max(40), quote: z.string().min(1).max(900), reason: z.string().trim().min(1).max(1500) });
const reviewSchema = z.strictObject({ decision: z.enum(["pass", "revise"]), issues: z.array(issueSchema).max(12) })
  .refine((r) => (r.decision === "pass") === (r.issues.length === 0));
const repairSchema = z.strictObject({ edits: z.array(z.strictObject({ field: z.enum(ANSWER_FIELDS), replacement: z.string().max(900).nullable() })).min(1).max(6) });

/** Internal trace for eval diagnostics. Never expose or log the draft/review text in production. */
export interface GroundingTrace {
  draft?: InterpretationOutput;
  repaired?: InterpretationOutput;
  repairAttempted: boolean;
  calls: { phase: "write" | "review" | "repair"; ms: number; model?: string; reason?: string; usage?: { inputTokens: number; outputTokens: number } }[];
  reviews: GroundingReview[];
}
export type ReviewedOutcome = ProviderOutcome<InterpretationOutput> & { quality: GroundingTrace };

function fieldText(answer: InterpretationOutput, field: AnswerField): string | null {
  if (field === "situation" || field === "challenge" || field === "guidance") return answer.cards.find((c) => c.position === field)!.relevance;
  return answer[field];
}

export function parseGroundingReview(raw: unknown, answer: InterpretationOutput): GroundingReview | undefined {
  const result = reviewSchema.safeParse(raw);
  if (!result.success) return;
  // Require an actual quote. If the model mislabels its field, a unique
  // exact match can locate it without guessing or discarding the finding.
  const issues: GroundingIssue[] = [];
  for (const issue of result.data.issues) {
    const named = (ANSWER_FIELDS as readonly string[]).includes(issue.field) ? (issue.field as AnswerField) : undefined;
    if (named && fieldText(answer, named)?.includes(issue.quote)) issues.push({ ...issue, field: named });
    else {
      const matches = ANSWER_FIELDS.filter((field) => fieldText(answer, field)?.includes(issue.quote));
      if (matches.length !== 1) return;
      issues.push({ ...issue, field: matches[0] });
    }
  }
  return { ...result.data, issues };
}

export function applyGroundingRepair(raw: unknown, answer: InterpretationOutput, review: GroundingReview): InterpretationOutput | undefined {
  const parsed = repairSchema.safeParse(raw);
  if (!parsed.success) return;
  const allowed = new Set(review.issues.map((i) => i.field));
  const fields = new Set(parsed.data.edits.map((e) => e.field));
  if (fields.size !== parsed.data.edits.length || fields.size !== allowed.size || [...fields].some((f) => !allowed.has(f))) return;
  const result = structuredClone(answer);
  for (const { field, replacement } of parsed.data.edits) {
    if (field === "beyondSpread") result.beyondSpread = replacement;
    else {
      if (replacement === null) return;
      if (field === "situation" || field === "challenge" || field === "guidance") result.cards.find((c) => c.position === field)!.relevance = replacement;
      else result[field] = replacement;
    }
  }
  return result;
}

/**
 * Shared production/eval publication gate: write -> review -> at most one
 * repair -> fresh review of the whole repaired answer. No candidate is
 * returned as a success without approval and structural validation.
 */
export async function generateReviewed(provider: GenerationProvider, input: InterpretationInput, drawnCardIds: string[], options: ProviderCallOptions = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS }): Promise<ReviewedOutcome> {
  const quality: GroundingTrace = { repairAttempted: false, calls: [], reviews: [] };
  const expired = () => Date.now() >= options.deadlineAt;
  const fail = (reason: string, uncertain = false): ReviewedOutcome => ({ ok: false, reason, retryable: false, uncertain, quality });
  async function call(phase: "write" | "review" | "repair", fn: () => Promise<ProviderOutcome<unknown>>) {
    const started = Date.now();
    const result = await fn();
    quality.calls.push({ phase, ms: Date.now() - started, ...(result.ok ? { model: result.model, usage: result.usage } : { reason: result.reason }) });
    return result;
  }
  if (expired()) return fail("request_deadline");
  const written = await call("write", () => provider.interpret(input, options));
  if (!written.ok) return { ...written, quality };
  if (expired()) return fail("request_deadline");
  const validated = validateInterpretation(written.value, drawnCardIds);
  if (!validated.ok) return { ok: false, reason: `output_invalid:${validated.reason}`, retryable: true, uncertain: false, quality };
  let answer = validated.output;
  let model = written.model;
  quality.draft = answer;

  for (let pass = 0; pass < 2; pass++) {
    if (expired()) return fail("request_deadline");
    const checked = await call("review", () => provider.review(input, answer, options));
    if (!checked.ok) return fail(isProviderRefusal(checked.reason) ? checked.reason : `grounding_review:${checked.reason}`, checked.uncertain);
    if (expired()) return fail("request_deadline");
    const review = parseGroundingReview(checked.value, answer);
    if (!review) return fail("grounding_review_invalid");
    quality.reviews.push(review);
    if (review.decision === "pass") {
      const usages = quality.calls.flatMap((c) => c.usage ? [c.usage] : []);
      const usage = usages.length ? usages.reduce((a, b) => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens }), { inputTokens: 0, outputTokens: 0 }) : undefined;
      return { ok: true, value: answer, model, usage, quality };
    }
    if (pass === 1) return fail("grounding_rejected");
    if (expired()) return fail("request_deadline");
    quality.repairAttempted = true;
    const repaired = await call("repair", () => provider.repair(input, answer, review.issues, options));
    if (!repaired.ok) return fail(isProviderRefusal(repaired.reason) ? repaired.reason : `grounding_repair:${repaired.reason}`, repaired.uncertain);
    if (expired()) return fail("request_deadline");
    const patched = applyGroundingRepair(repaired.value, answer, review);
    if (!patched) return fail("grounding_repair_invalid");
    const revalidated = validateInterpretation(patched, drawnCardIds);
    if (!revalidated.ok) return fail(`grounding_repair_invalid:${revalidated.reason}`);
    answer = revalidated.output;
    model = repaired.model;
    quality.repaired = answer;
  }
  return fail("grounding_rejected");
}
