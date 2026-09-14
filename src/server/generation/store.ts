import { and, eq } from "drizzle-orm";
import { readingGenerations } from "../db/schema";
import type { Executor } from "../access";
import { SAFETY_RESPONSES, isRefusalCategory, type SafetyCategory } from "@/content/safety";
import { GENERATION_KIND, GENERATION_MAX_ATTEMPTS, getGenerationConfig } from "./config";
import type { InterpretationOutput, InterpretationView } from "./types";

export type GenerationRow = typeof readingGenerations.$inferSelect;

export async function getGeneration(ex: Executor, readingId: string): Promise<GenerationRow | undefined> {
  const [row] = await ex
    .select()
    .from(readingGenerations)
    .where(and(eq(readingGenerations.readingId, readingId), eq(readingGenerations.kind, GENERATION_KIND)))
    .limit(1);
  return row;
}

/** A budget refusal is recorded on the row so the view can say "busy" without spending an attempt. */
export const BUDGET_REASON = "budget_exhausted";

/**
 * Pure projection of a generation row (or its absence) into what the client
 * renders. Side-effect free so `getResult` can call it on every read.
 */
export function viewOf(row: GenerationRow | undefined, grantBasis: string | undefined, question: string | null, now: number): InterpretationView {
  const config = getGenerationConfig();
  if (!config.enabled) return { status: "disabled" };
  if (!question) return { status: "not_applicable" };
  if (row?.status === "succeeded" && row.output) {
    return { status: "succeeded", answer: JSON.parse(row.output) as InterpretationOutput, model: row.model ?? "unknown", promptVersion: row.promptVersion };
  }
  if (row?.status === "refused" && row.safetyCategory && isRefusalCategory(row.safetyCategory as SafetyCategory)) {
    const category = row.safetyCategory as SafetyCategory;
    return { status: "refused", category, response: SAFETY_RESPONSES[category as keyof typeof SAFETY_RESPONSES] };
  }
  // Configuration and the guest switch come after stored results: an answer
  // already paid for stays readable when generation is paused later.
  if (config.providers.length === 0) return { status: "unavailable", reason: "not_configured" };
  if (grantBasis === "guest" && !config.guestEnabled) return { status: "unavailable", reason: "guest_paused" };
  if (!row) return { status: "idle" };

  if (row.status === "pending" || row.status === "provider_called") {
    if (row.leaseExpiresAt > now) return { status: "pending" };
    // A lost request. A pending lease spent nothing; a provider_called one did.
    return row.attempts >= GENERATION_MAX_ATTEMPTS
      ? { status: "failed", reason: "attempts_exhausted", retryable: false }
      : { status: "failed", reason: "lease_expired", retryable: true };
  }
  if (row.status === "failed") {
    // A budget refusal parks the row until the window turns over, then it is
    // simply retryable again — no attempt was spent.
    if (row.errorReason === BUDGET_REASON && row.leaseExpiresAt > now) {
      return { status: "unavailable", reason: "busy", retryAfterSeconds: Math.max(1, Math.ceil((row.leaseExpiresAt - now) / 1000)) };
    }
    return { status: "failed", reason: row.errorReason ?? "unknown", retryable: row.attempts < GENERATION_MAX_ATTEMPTS };
  }
  return { status: "failed", reason: "unknown_state", retryable: false };
}
