import { afterEach, describe, expect, it, vi } from "vitest";
import { getGenerationConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

function kinds() {
  return getGenerationConfig().providers.map((p) => p.kind);
}

describe("getGenerationConfig", () => {
  it("is off by default and defaults to the stub outside production", () => {
    vi.stubEnv("GENERATION_ENABLED", undefined);
    vi.stubEnv("GENERATION_PROVIDER", undefined);
    const config = getGenerationConfig();
    expect(config.enabled).toBe(false);
    expect(config.guestEnabled).toBe(true);
    expect(kinds()).toEqual(["stub"]);
  });

  it("prefers Gemini and falls back to DeepSeek in production without implicitly spending on Anthropic", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", undefined);
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    vi.stubEnv("DEEPSEEK_API_KEY", "d-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_WORKSPACE_ID", "wrkspc_1");
    const config = getGenerationConfig();
    expect(kinds()).toEqual(["gemini", "deepseek"]);
    expect(config.providers[0].models).toEqual({ answer: "gemini-3.8-flash", classifier: "gemini-3.8-flash" });
    expect(config.providers[1]).toMatchObject({ kind: "deepseek", models: { answer: "deepseek-flash" } });
    expect(config.reviewProvider).toBeUndefined();
    expect(config.configurationProblem).toContain("GENERATION_REVIEW_PROVIDER is not set");
  });

  it("configures the reviewer on its own, outside the writer chain if need be", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_WORKSPACE_ID", "wrkspc_1");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "anthropic");
    const config = getGenerationConfig();
    expect(kinds()).toEqual(["gemini"]);
    expect(config.reviewProvider).toMatchObject({ kind: "anthropic", workspaceId: "wrkspc_1", models: { answer: "claude-sonnet-5" } });
    expect(config.configurationProblem).toBeUndefined();
  });

  it("skips a provider whose key is missing and says so, keeping the rest", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "gemini,anthropic");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const config = getGenerationConfig();
    expect(kinds()).toEqual(["anthropic"]);
    expect(config.configurationProblem).toContain("GEMINI_API_KEY");
  });

  it("never uses the stub in production and reports nothing usable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "stub");
    const config = getGenerationConfig();
    expect(config.providers).toEqual([]);
    expect(config.configurationProblem).toContain("stub");

    vi.stubEnv("GENERATION_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "  ");
    expect(getGenerationConfig()).toMatchObject({ providers: [], configurationProblem: expect.stringContaining("ANTHROPIC_API_KEY") });
  });

  it("honours the older Anthropic model variable names", () => {
    vi.stubEnv("GENERATION_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("GENERATION_MODEL", "claude-opus-5");
    expect(getGenerationConfig().providers[0].models.answer).toBe("claude-opus-5");
  });

  it("assumes no reviewer vendor, and names a reviewer whose key is missing", () => {
    vi.stubEnv("GENERATION_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", undefined);
    expect(getGenerationConfig().reviewProvider).toBeUndefined();
    expect(getGenerationConfig().configurationProblem).toContain("GENERATION_REVIEW_PROVIDER is not set");

    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const config = getGenerationConfig();
    expect(config.reviewProvider).toBeUndefined();
    expect(config.configurationProblem).toContain("reviewer unavailable (anthropic skipped: ANTHROPIC_API_KEY is not set.)");
  });

  it("implies the stub reviewer only for an all-stub writer chain outside production", () => {
    vi.stubEnv("GENERATION_PROVIDER", "stub");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", undefined);
    expect(getGenerationConfig().reviewProvider?.kind).toBe("stub");
    vi.stubEnv("NODE_ENV", "production");
    expect(getGenerationConfig().reviewProvider).toBeUndefined();
  });

  it("supports an explicit calibrated review model without changing the writer", () => {
    vi.stubEnv("GENERATION_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "gemini");
    vi.stubEnv("GENERATION_REVIEW_MODEL", "review-model");
    vi.stubEnv("GEMINI_REVIEW_THINKING_LEVEL", "low");
    const config = getGenerationConfig();
    expect(config.reviewProvider?.models.answer).toBe("review-model");
    expect(config.providers[0].models.answer).toBe("gemini-3.8-flash");
    expect(config.reviewProvider?.thinkingLevel).toBe("low");
    expect(config.providers[0].thinkingLevel).toBeUndefined();
  });

  it("reads flags leniently and falls back on bad numbers", () => {
    vi.stubEnv("GENERATION_ENABLED", "TRUE");
    vi.stubEnv("GUEST_GENERATION_ENABLED", "0");
    vi.stubEnv("GENERATION_LIMIT_GLOBAL_DAY", "lots");
    vi.stubEnv("GENERATION_LIMIT_SESSION_DAY", "3");
    const config = getGenerationConfig();
    expect(config.enabled).toBe(true);
    expect(config.guestEnabled).toBe(false);
    expect(config.limits.globalPerDay).toBe(400);
    expect(config.limits.sessionPerDay).toBe(3);
  });
});

describe("deepseek", () => {
  it("joins the chain or serves as reviewer with its own key and models", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "deepseek,gemini");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-d");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    const config = getGenerationConfig();
    expect(config.providers.map((p) => p.kind)).toEqual(["deepseek", "gemini"]);
    expect(config.providers[0].models).toEqual({ answer: "deepseek-v4-pro", classifier: "deepseek-flash" });
    expect(config.reviewProvider).toMatchObject({ kind: "deepseek", models: { answer: "deepseek-v4-pro" } });
    expect(config.configurationProblem).toBeUndefined();
  });
});

it("keeps Gemini writer, classifier and reviewer effort independent", () => {
  vi.stubEnv("GENERATION_PROVIDER", "gemini"); vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GENERATION_CLASSIFIER_PROVIDER", "gemini"); vi.stubEnv("GENERATION_REVIEW_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_WRITER_THINKING_LEVEL", "low"); vi.stubEnv("GEMINI_CLASSIFIER_THINKING_LEVEL", "high"); vi.stubEnv("GEMINI_REVIEW_THINKING_LEVEL", "medium");
  const config = getGenerationConfig();
  expect([config.providers[0].thinkingLevel, config.classifierProvider?.thinkingLevel, config.reviewProvider?.thinkingLevel]).toEqual(["low", "high", "medium"]);
  vi.stubEnv("GEMINI_CLASSIFIER_THINKING_LEVEL", undefined);
  expect(getGenerationConfig().classifierProvider?.thinkingLevel).toBeUndefined();
});
