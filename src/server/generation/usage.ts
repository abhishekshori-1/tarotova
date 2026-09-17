import type { TokenUsage, ProviderOutcome, ProviderCallRecord } from "./types";

/** Preserve cache accounting through a multi-call pipeline, not just its trace. */
export function sumUsage(usages: TokenUsage[]): TokenUsage {
  const sum: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  for (const usage of usages) {
    sum.inputTokens += usage.inputTokens;
    sum.outputTokens += usage.outputTokens;
    for (const key of ["cacheWriteTokens", "cacheReadTokens", "cacheWrite5mTokens", "cacheWrite1hTokens"] as const) {
      if (usage[key] !== undefined) sum[key] = (sum[key] ?? 0) + usage[key];
    }
  }
  return sum;
}

export function totalInputTokens(usage: TokenUsage): number {
  return usage.inputTokens + (usage.cacheWriteTokens ?? 0) + (usage.cacheReadTokens ?? 0);
}

/** Expand a fallback chain once; never count its winning response a second time. */
export function providerCalls(result: ProviderOutcome<unknown>, ms: number, provider?: string): ProviderCallRecord[] {
  return result.calls ?? [{ provider, ms, model: result.model, usage: result.usage,
    ...(!result.ok ? { reason: result.reason, detail: result.detail } : {}) }];
}
