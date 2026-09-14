import { afterEach, describe, expect, it, vi } from "vitest";
import { getGenerationConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("getGenerationConfig", () => {
  it("is off by default and defaults to the stub outside production", () => {
    vi.stubEnv("GENERATION_ENABLED", undefined);
    vi.stubEnv("GENERATION_PROVIDER", undefined);
    const config = getGenerationConfig();
    expect(config.enabled).toBe(false);
    expect(config.guestEnabled).toBe(true);
    expect(config.provider).toBe("stub");
  });

  it("never uses the stub in production and requires a key for anthropic", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "stub");
    expect(getGenerationConfig().provider).toBeNull();

    vi.stubEnv("GENERATION_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "  ");
    expect(getGenerationConfig()).toMatchObject({ provider: null, configurationProblem: expect.stringContaining("ANTHROPIC_API_KEY") });

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(getGenerationConfig().provider).toBe("anthropic");
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
