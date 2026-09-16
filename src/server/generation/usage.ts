import type { TokenUsage } from "./types";

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
