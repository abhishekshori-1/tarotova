import type { TokenUsage } from "@/server/generation/types";
import { sumUsage, totalInputTokens } from "@/server/generation/usage";

// USD per million tokens, checked 2026-09-16. Evaluation estimates only:
// https://api-docs.deepseek.com/quick_start/pricing/ (peak rates)
// https://ai.google.dev/gemini-api/docs/latest-model (introductory, ends 2026-12-31)
// https://platform.claude.com/docs/en/about-claude/pricing
const RATES: Record<string, { input: number; output: number; read: number; write5m?: number; write1h?: number }> = {
  "deepseek-flash": { input: 0.3, output: 1.2, read: 0.006 },
  "deepseek-v4-pro": { input: 1.32, output: 3.96, read: 0.044 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75, read: 0.075 },
  "claude-sonnet-5": { input: 2, output: 10, read: 0.2, write5m: 2.5, write1h: 4 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, read: 0.1, write5m: 1.25, write1h: 2 },
};

export interface CostCall {
  phase: string;
  model?: string;
  usage?: TokenUsage;
}

/** Unknown models/counters are not priced as zero or guessed. */
export function estimateCost(model: string | undefined, usage: TokenUsage, noAnthropicCache = false): number | undefined {
  const rates = model ? RATES[model] : undefined;
  if (!rates) return;
  const writes = usage.cacheWriteTokens ?? 0;
  const writes5m = usage.cacheWrite5mTokens ?? 0;
  const writes1h = usage.cacheWrite1hTokens ?? 0;
  if (writes !== writes5m + writes1h || (writes && rates.write5m === undefined)) return;
  const input = noAnthropicCache && model === "claude-sonnet-5"
    ? totalInputTokens(usage) * rates.input
    : usage.inputTokens * rates.input + (usage.cacheReadTokens ?? 0) * rates.read + writes5m * (rates.write5m ?? 0) + writes1h * (rates.write1h ?? 0);
  return (input + usage.outputTokens * rates.output) / 1_000_000;
}

/** Same observed calls, with/without Anthropic caching: isolates cache savings from generation randomness. */
export function costSummary(calls: CostCall[], label: string): string[] {
  const rows = new Map<string, { model?: string; phase: string; usages: TokenUsage[] }>();
  let missing = 0;
  for (const call of calls) {
    if (call.phase === "validate") continue;
    if (!call.usage) { missing++; continue; }
    const key = `${call.phase}:${call.model}`;
    const row = rows.get(key) ?? { phase: call.phase, model: call.model, usages: [] };
    row.usages.push(call.usage);
    rows.set(key, row);
  }
  let estimated = 0;
  let uncached = 0;
  let unknown = 0;
  const lines = [`### ${label}`, "", "| Phase | Model | Calls with usage | Uncached input | Cache read | Cache write 5m / 1h | Output | Estimated USD |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for (const row of rows.values()) {
    const u = sumUsage(row.usages);
    const amount = estimateCost(row.model, u);
    const without = estimateCost(row.model, u, true);
    if (amount === undefined || without === undefined) unknown += row.usages.length;
    else { estimated += amount; uncached += without; }
    lines.push(`| ${row.phase} | ${row.model ?? "unknown"} | ${row.usages.length} | ${u.inputTokens} | ${u.cacheReadTokens ?? 0} | ${u.cacheWrite5mTokens ?? 0} / ${u.cacheWrite1hTokens ?? 0} | ${u.outputTokens} | ${amount === undefined ? "unpriced" : amount.toFixed(5)} |`);
  }
  lines.push("", `Known-call estimate: $${estimated.toFixed(5)}. The same observed calls without Anthropic caching: $${uncached.toFixed(5)}. Cache difference: $${(uncached - estimated).toFixed(5)} (${uncached ? (100 * (uncached - estimated) / uncached).toFixed(1) : "0.0"}%).`, "",
    `Calls without usage: ${missing}; calls with unknown pricing: ${unknown}. Failed fallback calls are included when usage is reported; calls without usage remain unpriced and may add charges. This is not a bill. DeepSeek uses peak rates as a conservative estimate; off-peak rates are lower. Prices checked 2026-09-16; update eval/cost.ts when prices or model IDs change.`, "");
  return lines;
}
