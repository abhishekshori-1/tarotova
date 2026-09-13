import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/readings/[id]/otp/route";
import { requestOtp, RateLimitedError } from "@/server/readingService";
import { EmailConfigurationError } from "@/server/email";
import { ensureMigrated } from "@/server/db/migrate";
import { verifyTurnstile } from "@/server/turnstile";
import { resolveSession } from "@/server/session";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn().mockResolvedValue({ id: "session", isNew: false }) }));
vi.mock("@/server/turnstile", () => ({ verifyTurnstile: vi.fn().mockResolvedValue(true) }));
vi.mock("@/server/readingService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/readingService")>(),
  requestOtp: vi.fn(),
}));

function request() {
  return POST(new Request("https://tarotova.example/api/readings/reading/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 1, intent: "send", email: "reader@example.com", turnstileToken: "test-token" }),
  }), { params: Promise.resolve({ id: "reading" }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ensureMigrated).mockResolvedValue(undefined);
  vi.mocked(resolveSession).mockResolvedValue({ id: "session", isNew: false });
  vi.mocked(verifyTurnstile).mockResolvedValue(true);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("OTP HTTP outcomes", () => {
  it.each([
    ["accepted", 200], ["pending", 202], ["failed", 502],
  ] as const)("returns %s delivery as HTTP %s", async (sendStatus, status) => {
    vi.mocked(requestOtp).mockResolvedValueOnce({ readingId: "reading", challengeId: "challenge", sendStatus, devCode: undefined });
    const response = await request();
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    const body = await response.json();
    expect(body.sendStatus).toBe(sendStatus);
    if (sendStatus === "failed") expect(body.error).toBe("email_send_failed");
  });

  it("returns the rate-limit wait and records where the request stopped", async () => {
    vi.mocked(requestOtp).mockRejectedValueOnce(new RateLimitedError(90_001));
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("91");
    expect(console.info).toHaveBeenCalledWith("[otp_request]", expect.objectContaining({ stage: "request_otp", status: 429 }));
  });

  it("returns an actionable service failure for missing email configuration", async () => {
    vi.mocked(requestOtp).mockRejectedValueOnce(new EmailConfigurationError("RESEND_API_KEY is required for Resend."));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "email_not_configured" });
  });

  it("does not attempt an OTP send when Turnstile rejects the token", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
    const response = await request();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bot_check_failed" });
    expect(requestOtp).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("[otp_request]", expect.objectContaining({ stage: "turnstile", status: 400 }));
  });

  it("catches migration failures and records the failing stage", async () => {
    vi.mocked(ensureMigrated).mockRejectedValueOnce(new Error("migration failed"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal_error" });
    expect(requestOtp).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("[otp_request]", expect.objectContaining({ stage: "migration", status: 500 }));
  });
});
