import { afterEach, describe, expect, it, vi } from "vitest";
import { getGenerationConfig } from "./config";
import { getGenerationProvider } from "./service";
import { GeminiProvider } from "./gemini";
import { DeepSeekProvider } from "./deepseek";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("independent classifier", () => {
  it("keeps the writer chain's first provider for triage when unset", () => {
    vi.stubEnv("GENERATION_PROVIDER", "deepseek,gemini");
    vi.stubEnv("DEEPSEEK_API_KEY", "d");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "gemini");
    expect(getGenerationConfig().classifierProvider).toBeUndefined();
  });

  it("routes classify to the named vendor and everything else to the writer chain", async () => {
    vi.stubEnv("GENERATION_PROVIDER", "deepseek,gemini");
    vi.stubEnv("DEEPSEEK_API_KEY", "d");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "gemini");
    vi.stubEnv("GENERATION_CLASSIFIER_PROVIDER", "gemini");
    const config = getGenerationConfig();
    expect(config.classifierProvider?.kind).toBe("gemini");
    expect(config.configurationProblem).toBeUndefined();
    const gemini = vi.spyOn(GeminiProvider.prototype, "classify").mockResolvedValue({ ok: true, value: "none", model: "gemini-3.8-flash" });
    const deepseek = vi.spyOn(DeepSeekProvider.prototype, "classify");
    const provider = getGenerationProvider(config)!;
    expect(await provider.classify("hello")).toMatchObject({ ok: true, value: "none" });
    expect(gemini).toHaveBeenCalledOnce();
    expect(deepseek).not.toHaveBeenCalled();
  });

  it("names a classifier whose key is missing and falls back to the chain", () => {
    vi.stubEnv("GENERATION_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "d");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "deepseek");
    vi.stubEnv("GENERATION_CLASSIFIER_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    const config = getGenerationConfig();
    expect(config.classifierProvider).toBeUndefined();
    expect(config.configurationProblem).toContain("classifier unavailable");
  });
});
