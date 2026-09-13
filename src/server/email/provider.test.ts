import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consoleEmailProvider, EmailConfigurationError, getEmailProvider } from "./index";
import { ResendEmailProvider } from "./resend-provider";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "test-api-key");
  vi.stubEnv("EMAIL_FROM", "Tarotova <codes@example.com>");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email configuration", () => {
  it.each([undefined, "console", "typo"])("rejects production provider %s instead of silently accepting a console send", (provider) => {
    vi.stubEnv("EMAIL_PROVIDER", provider);
    expect(() => getEmailProvider()).toThrow(EmailConfigurationError);
  });

  it.each(["RESEND_API_KEY", "EMAIL_FROM"])("rejects missing %s", (key) => {
    vi.stubEnv(key, "  ");
    expect(() => getEmailProvider()).toThrow(EmailConfigurationError);
  });

  it("allows the default console provider only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_PROVIDER", undefined);
    expect(getEmailProvider()).toBe(consoleEmailProvider);
  });

  it("does not silently fall back when Resend is explicitly selected in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(() => getEmailProvider()).toThrow(EmailConfigurationError);
  });
});

describe("Resend submission", () => {
  const params = { to: "reader@example.com", code: "012345", subjectId: "reading", idempotencyKey: "challenge" };

  it("submits the OTP and challenge idempotency key and requires an accepted message id", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: "resend-message-id" }));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("EMAIL_PROVIDER", " resend \n");
    vi.stubEnv("RESEND_API_KEY", " test-api-key \n");
    const provider = getEmailProvider();
    expect(provider).toBeInstanceOf(ResendEmailProvider);
    expect(await provider.sendVerificationCode(params)).toEqual({ status: "accepted", providerMessageId: "resend-message-id" });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer test-api-key", "Idempotency-Key": "challenge", "User-Agent": "Tarotova/0.1" },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(init.body)).toMatchObject({ to: params.to, from: "Tarotova <codes@example.com>", text: expect.stringContaining("012345") });
  });

  it.each([401, 403, 429, 500])("preserves HTTP %s as a diagnostic failure", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "provider detail" }, { status })));
    expect(await getEmailProvider().sendVerificationCode(params)).toEqual({ status: "failed", reason: `resend_http_${status}` });
  });

  it.each([{}, { id: null }, { id: "" }])("does not invent an accepted message id for %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    expect(await getEmailProvider().sendVerificationCode(params)).toEqual({ status: "failed", reason: "resend_invalid_response" });
  });

  it("reports network errors as uncertain acceptance without leaking the exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private network detail")));
    expect(await getEmailProvider().sendVerificationCode(params)).toEqual({ status: "failed", reason: "network_error_or_timeout" });
  });
});
