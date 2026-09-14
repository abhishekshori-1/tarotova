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

  it("prefers Gemini and falls back to Anthropic in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", undefined);
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_WORKSPACE_ID", "wrkspc_1");
    const config = getGenerationConfig();
    expect(kinds()).toEqual(["gemini", "anthropic"]);
    expect(config.providers[0].models).toEqual({ answer: "gemini-3.1-pro-preview", classifier: "gemini-3.6-flash" });
    expect(config.providers[1]).toMatchObject({ workspaceId: "wrkspc_1", models: { answer: "claude-sonnet-5" } });
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
