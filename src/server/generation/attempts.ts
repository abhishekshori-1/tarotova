import { GENERATION_MAX_ATTEMPTS, GENERATION_REQUEST_BUDGET_MS } from "./config";
import type { ReviewedOutcome } from "./reviewed";

/**
 * Production's bounded retry, shared with the evaluation harness so the two
 * measure the same thing: a request may start another paid attempt while
 * attempts remain, the request deadline has not passed, and (for any attempt
 * after the request's first) the request budget has not been used up.
 */
export interface AttemptPolicy {
  maxAttempts: number;
  deadlineAt: number;
  requestStartedAt: number;
  budgetMs: number;
}

export function attemptPolicy(deadlineAt: number, requestStartedAt = Date.now()): AttemptPolicy {
  return { maxAttempts: GENERATION_MAX_ATTEMPTS, deadlineAt, requestStartedAt, budgetMs: GENERATION_REQUEST_BUDGET_MS };
}

/** `attempts` is the count already spent on this row; `firstAttempt` the count when this request began. */
export function mayAttempt(attempts: number, firstAttempt: number, policy: AttemptPolicy, now = Date.now()): boolean {
  return attempts < policy.maxAttempts && now < policy.deadlineAt && (attempts === firstAttempt || now - policy.requestStartedAt < policy.budgetMs);
}

/**
 * Runs the reviewed pipeline under the policy. Only a retryable outcome (a
 * structurally invalid draft, a provider failure) starts another attempt; a
 * grounding rejection is terminal, exactly as in production. Every attempt's
 * trace is kept so the caller can count all calls and costs.
 */
export async function runAttempts<T>(policy: AttemptPolicy, run: (attempt: number) => Promise<ReviewedOutcome<T>>): Promise<{ outcome: ReviewedOutcome<T> | undefined; attempts: number; outcomes: ReviewedOutcome<T>[] }> {
  const outcomes: ReviewedOutcome<T>[] = [];
  let attempts = 0;
  while (mayAttempt(attempts, 0, policy)) {
    attempts += 1;
    const outcome = await run(attempts);
    outcomes.push(outcome);
    if (outcome.ok || !outcome.retryable) break;
  }
  return { outcome: outcomes.at(-1), attempts, outcomes };
}
