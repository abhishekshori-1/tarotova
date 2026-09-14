import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets, suppressedEmails } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import * as emailProviders from "@/server/email";
import { hashEmailForLookup } from "@/server/emailHash";
import { MAX_ATTEMPTS } from "@/server/otp";
import { RateLimitedError, ValidationError } from "@/server/errors";
import { confirmSessionCode, getSessionVerification, requestSessionCode } from "@/server/sessionVerification";
import { createReading } from "@/server/readingService";

const DAY = 24 * 60 * 60 * 1000;

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * DAY });
  return id;
}

function codeFor(subjectId: string) {
  return (consoleEmailProvider as unknown as { lastCodeFor(id: string): string | undefined }).lastCodeFor(subjectId)!;
}

let n = 0;
const freshEmail = () => `visitor${++n}@example.com`;

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("session continuation verification (docs/ACCESS-FLOW.md section 6)", () => {
  it("starts unverified and becomes verified for a fixed 30-day window", async () => {
    const session = await createSession();
    expect((await getSessionVerification(session)).verified).toBe(false);

    const sent = await requestSessionCode(session, freshEmail(), "127.0.0.1");
    expect(sent.sendStatus).toBe("accepted");
    expect(sent.devCode).toMatch(/^\d{6}$/);
    expect((await getSessionVerification(session)).pendingChallenge?.attemptsRemaining).toBe(MAX_ATTEMPTS);

    const before = Date.now();
    expect((await confirmSessionCode(session, codeFor(session))).ok).toBe(true);
    const after = await getSessionVerification(session);
    expect(after.verified).toBe(true);
    expect(after.verifiedUntil).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(after.maskedEmail).toMatch(/^v•+@example\.com$/);
    expect(after.pendingChallenge).toBeUndefined();
  });

  it("does not extend the verification window on later activity", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    await confirmSessionCode(session, codeFor(session));
    const { verifiedUntil } = await getSessionVerification(session);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10 * DAY);
    await createReading(session);
    expect((await getSessionVerification(session)).verifiedUntil).toBe(verifiedUntil);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * DAY);
    expect((await getSessionVerification(session)).verified).toBe(false);
  });

  it("rejects wrong, superseded and exhausted codes, committing each failed attempt", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    const first = codeFor(session);
    expect(await confirmSessionCode(session, "000000")).toEqual({ ok: false, reason: "wrong_code" });
    expect((await getSessionVerification(session)).pendingChallenge?.attemptsRemaining).toBe(MAX_ATTEMPTS - 1);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    expect(codeFor(session)).not.toBe(first);
    expect((await confirmSessionCode(session, first)).ok).toBe(false);

    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirmSessionCode(session, "000000");
    expect(await confirmSessionCode(session, codeFor(session))).toEqual({ ok: false, reason: "attempts_exhausted" });
    expect((await getSessionVerification(session)).verified).toBe(false);
  });

  it("rejects an expired code", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    const code = codeFor(session);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    expect(await confirmSessionCode(session, code)).toEqual({ ok: false, reason: "expired" });
  });

  it("never accepts another session's code, even with an open challenge of its own", async () => {
    const a = await createSession();
    const b = await createSession();
    await requestSessionCode(a, freshEmail(), "10.0.0.1");
    const codeA = codeFor(a);
    expect(await confirmSessionCode(b, codeA)).toEqual({ ok: false, reason: "no_active_code" });
    await requestSessionCode(b, freshEmail(), "10.0.0.2");
    expect((await confirmSessionCode(b, codeA)).ok).toBe(false);
    expect((await getSessionVerification(b)).verified).toBe(false);
  });

  it("treats a repeated confirmation after success as idempotent", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    const code = codeFor(session);
    expect((await confirmSessionCode(session, code)).ok).toBe(true);
    expect((await confirmSessionCode(session, code)).ok).toBe(true);
    expect((await confirmSessionCode(session, "999999")).ok).toBe(true);
  });
});

describe("send budgets and delivery (PLAN.md section 6/8)", () => {
  it("does not spend send budgets on repeated attempts during the resend cooldown", async () => {
    const session = await createSession();
    const address = freshEmail();
    await requestSessionCode(session, address, "127.0.0.1");
    for (let i = 0; i < 3; i++) await expect(requestSessionCode(session, address, "127.0.0.1")).rejects.toThrow(RateLimitedError);
    const buckets = await db.select().from(rateLimitBuckets);
    expect(buckets).toHaveLength(3);
    expect(buckets.every((b) => b.count === 1)).toBe(true);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    expect((await requestSessionCode(session, address, "127.0.0.1")).sendStatus).toBe("accepted");
  });

  it("blocks a fourth code to the same address within an hour (3/hour per email)", async () => {
    const address = freshEmail();
    for (let i = 0; i < 3; i++) await requestSessionCode(await createSession(), address, `10.0.0.${i}`);
    await expect(requestSessionCode(await createSession(), address, "10.0.0.99")).rejects.toThrow(RateLimitedError);
  });

  it("refuses to send to a suppressed address", async () => {
    const address = freshEmail();
    await db.insert(suppressedEmails).values({ id: randomId(), normalizedLookupHash: hashEmailForLookup(address), reason: "hard_bounce", firstSuppressedAt: Date.now() });
    await expect(requestSessionCode(await createSession(), address, "127.0.0.1")).rejects.toThrow(ValidationError);
  });

  it("does not create a challenge or spend budgets when email is misconfigured", async () => {
    const session = await createSession();
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", undefined);
    await expect(requestSessionCode(session, freshEmail(), "127.0.0.1")).rejects.toThrow(emailProviders.EmailConfigurationError);
    expect((await getSessionVerification(session)).pendingChallenge).toBeUndefined();
    expect(await db.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.action, "otp_send_hour"))).toEqual([]);
  });

  it.each([
    ["resend_http_403", "failed"],
    ["network_error_or_timeout", "pending"],
    ["resend_invalid_response", "pending"],
  ] as const)("persists %s as %s and logs a reason without exposing the code or email", async (reason, status) => {
    const session = await createSession();
    const address = freshEmail();
    const send = vi.fn().mockResolvedValue({ status: "failed", reason });
    vi.spyOn(emailProviders, "getEmailProvider").mockReturnValue({ name: "resend", sendVerificationCode: send });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    const result = await requestSessionCode(session, address, "127.0.0.1");
    expect(result.sendStatus).toBe(status);
    expect(result.devCode).toBeUndefined();
    expect((await getSessionVerification(session)).pendingChallenge?.sendStatus).toBe(status);
    expect(log).toHaveBeenCalledWith("[otp_delivery]", expect.objectContaining({ failureReason: reason, sendStatus: status }));
    const code = send.mock.calls[0][0].code;
    const logs = JSON.stringify(log.mock.calls);
    expect(logs).not.toContain(address);
    expect(logs).not.toContain(code);
    // An uncertain send leaves a usable code (PLAN.md section 6).
    if (status === "pending") expect((await confirmSessionCode(session, code)).ok).toBe(true);
  });
});
