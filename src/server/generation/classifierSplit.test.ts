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

describe("independent repairer", () => {
  it("keeps the writer chain for repairs when unset, and routes only the repair calls when set", async () => {
    vi.stubEnv("GENERATION_PROVIDER", "deepseek,gemini");
    vi.stubEnv("DEEPSEEK_API_KEY", "d");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "gemini");
    expect(getGenerationConfig().repairProvider).toBeUndefined();
    vi.stubEnv("GENERATION_REPAIR_PROVIDER", "gemini");
    const config = getGenerationConfig();
    expect(config.repairProvider?.kind).toBe("gemini");
    const deepseekWrite = vi.spyOn(DeepSeekProvider.prototype, "followup").mockResolvedValue({ ok: true, value: {}, model: "deepseek-flash" });
    const deepseekRepair = vi.spyOn(DeepSeekProvider.prototype, "repairFollowup").mockResolvedValue({ ok: true, value: {}, model: "deepseek-flash" });
    const geminiRepair = vi.spyOn(GeminiProvider.prototype, "repairFollowup").mockResolvedValue({ ok: true, value: {}, model: "gemini-3.8-flash" });
    const provider = getGenerationProvider(config)!;
    const input = {} as never;
    await provider.followup(input);
    await provider.repairFollowup(input, {} as never, []);
    expect(deepseekWrite).toHaveBeenCalledTimes(1);
    expect(geminiRepair).toHaveBeenCalledTimes(1);
    expect(deepseekRepair).not.toHaveBeenCalled();
  });

  it("names a repairer whose key is missing and falls back to the chain", () => {
    vi.stubEnv("GENERATION_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "d");
    vi.stubEnv("GENERATION_REVIEW_PROVIDER", "deepseek");
    vi.stubEnv("GENERATION_REPAIR_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    const config = getGenerationConfig();
    expect(config.repairProvider).toBeUndefined();
    expect(config.configurationProblem).toContain("repairer unavailable");
  });
});
