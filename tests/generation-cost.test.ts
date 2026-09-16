import { describe, expect, it } from "vitest";
import { costSummary, estimateCost } from "../eval/cost";
import { sumUsage, totalInputTokens } from "@/server/generation/usage";

describe("cache-aware cost accounting", () => {
  it("preserves mixed TTL writes and reads without counting the write breakdown twice", () => {
    const usage = sumUsage([
      { inputTokens: 100, outputTokens: 10, cacheWriteTokens: 1000, cacheWrite5mTokens: 1000 },
      { inputTokens: 100, outputTokens: 10, cacheReadTokens: 1000, cacheWriteTokens: 500, cacheWrite1hTokens: 500 },
    ]);
    expect(totalInputTokens(usage)).toBe(2700);
    expect(estimateCost("claude-sonnet-5", usage)).toBeCloseTo(0.0053);
    expect(estimateCost("claude-sonnet-5", usage, true)).toBeCloseTo(0.0056);
  });

  it("exposes the cache-write premium on a cold singleton instead of claiming savings", () => {
    const lines = costSummary([{ phase: "review", model: "claude-sonnet-5", usage: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1000, cacheWrite5mTokens: 1000 } }], "Cold review").join("\n");
    expect(lines).toContain("$0.00250");
    expect(lines).toContain("$-0.00050 (-25.0%)");
  });

  it("does not count DeepSeek cache hits again at the ordinary input price", () => {
    expect(estimateCost("deepseek-flash", { inputTokens: 100, cacheReadTokens: 900, outputTokens: 10 })).toBeCloseTo(0.0000474);
  });

  it("marks unknown models, incomplete cache writes and failed calls honestly", () => {
    expect(estimateCost("other-model", { inputTokens: 100, outputTokens: 10 })).toBeUndefined();
    expect(estimateCost("claude-sonnet-5", { inputTokens: 100, outputTokens: 10, cacheWriteTokens: 500 })).toBeUndefined();
    const lines = costSummary([{ phase: "review" }, { phase: "validate" }, { phase: "write", model: "other", usage: { inputTokens: 10, outputTokens: 1 } }], "Unknown").join("\n");
    expect(lines).toContain("Calls without usage: 1; calls with unknown pricing: 1");
  });
});
