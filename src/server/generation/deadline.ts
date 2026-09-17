import type { ProviderCallOptions, ProviderOutcome } from "./types";

export function callTimeout(timeoutMs: number, options?: ProviderCallOptions): number {
  return Math.max(0, Math.min(timeoutMs, (options?.deadlineAt ?? Infinity) - Date.now()));
}

/** Nothing was sent when the request has already run out of time. */
export function deadlineExceeded(): Extract<ProviderOutcome<never>, { ok: false }> {
  return { ok: false, reason: "request_deadline", retryable: true, uncertain: false };
}

/** Only a transport code, never an exception message that could echo request data. */
export function networkDetail(error: unknown): string | undefined {
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof code === "string" && /^(EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|UND_ERR_[A-Z_]+)$/.test(code) ? code : undefined;
}
