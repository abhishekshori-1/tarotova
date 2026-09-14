import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile, BotCheckConfigurationError } from "@/server/turnstile";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile configuration", () => {
  it.each(["", "   ", undefined])("fails closed in production when the secret is %j", async (secret) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
    await expect(verifyTurnstile("token", "127.0.0.1")).rejects.toThrow(BotCheckConfigurationError);
  });

  it("passes with a warning outside production when no secret is set", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TURNSTILE_SECRET_KEY", undefined);
    await expect(verifyTurnstile(undefined, "127.0.0.1")).resolves.toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("verifyTurnstile with a configured secret", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  });

  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyTurnstile(undefined, "127.0.0.1")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ success: true }, true],
    [{ success: false }, false],
    [{}, false],
  ])("maps Cloudflare's %j to %s", async (body, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    await expect(verifyTurnstile("token", "127.0.0.1")).resolves.toBe(expected);
  });

  it("treats a network failure as a rejected check", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(verifyTurnstile("token", "127.0.0.1")).resolves.toBe(false);
  });
});
