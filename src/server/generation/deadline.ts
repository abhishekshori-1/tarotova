import type { ProviderCallOptions, ProviderOutcome } from "./types";

export function callTimeout(timeoutMs: number, options?: ProviderCallOptions): number {
  return Math.max(0, Math.min(timeoutMs, (options?.deadlineAt ?? Infinity) - Date.now()));
}

/** Nothing was sent when the request has already run out of time. */
export function deadlineExceeded(): Extract<ProviderOutcome<never>, { ok: false }> {
  return { ok: false, reason: "request_deadline", retryable: true, uncertain: false };
}
