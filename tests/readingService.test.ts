import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, suppressedEmails, rateLimitBuckets } from "@/server/db/schema";
import * as emailProviders from "@/server/email";
import { randomId } from "@/server/ids";
import { hashEmailForLookup } from "@/server/emailHash";
import { consoleEmailProvider } from "@/server/email/console-provider";
import { MAX_ATTEMPTS } from "@/server/otp";
import {
  createReading,
  getStatus,
  getResult,
  requestOtp,
  reshuffle,
  updateSelection,
  verifyOtp,
  ConflictError,
  OwnershipError,
  ValidationError,
  RateLimitedError,
} from "@/server/readingService";

// PLAN.md section 9's "Database/API integration" row, exercised directly
// against readingService (no HTTP layer) with an in-memory pglite database
// (see tests/setup.ts and db/client.ts). Session ids are plain strings here —
// resolveSession() itself depends on next/headers and is exercised only
// inside the running app.

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * 24 * 60 * 60 * 1000 });
  return id;
}

async function lockedReading(sessionId: string, slots: [number, number, number] = [0, 1, 2]) {
  const draft = await createReading(sessionId);
  return updateSelection(draft.id, sessionId, draft.revision, slots, true, undefined);
}

async function codeFor(readingId: string) {
  const c = consoleEmailProvider as unknown as { lastCodeFor(id: string): string | undefined };
  return c.lastCodeFor(readingId);
}

let email = 0;
function freshEmail() {
  email += 1;
  return `person${email}@example.com`;
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("createReading / getStatus", () => {
  it("starts in drafting state with no cards resolved", async () => {
    const session = await createSession();
    const status = await createReading(session);
    expect(status.state).toBe("drafting");
    expect(status.selectedSlots).toEqual([]);
    expect(status.locked).toBe(false);
    expect(status.resultAvailable).toBe(false);
  });

  it("denies access to a reading owned by a different session (PLAN.md section 9: wrong owner denied)", async () => {
    const owner = await createSession();
    const stranger = await createSession();
    const status = await createReading(owner);
    await expect(getStatus(status.id, stranger)).rejects.toThrow(OwnershipError);
  });

  it("denies access to a reading id that doesn't exist", async () => {
    const session = await createSession();
    await expect(getStatus("does-not-exist", session)).rejects.toThrow(OwnershipError);
  });
});

describe("reshuffle", () => {
  it("allows reshuffling only while the selection is empty", async () => {
    const session = await createSession();
    const status = await createReading(session);
    const afterSelect = await updateSelection(status.id, session, status.revision, [0], false, undefined);
    await expect(reshuffle(status.id, session, afterSelect.revision)).rejects.toThrow(ValidationError);
  });

  it("rejects a stale revision (PLAN.md section 9: draft revision conflicts)", async () => {
    const session = await createSession();
    const status = await createReading(session);
    try {
      await reshuffle(status.id, session, status.revision + 1);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as ConflictError).currentRevision).toBe(status.revision);
    }
  });
});

describe("updateSelection locking", () => {
  it("locks exactly three distinct slots and freezes a result snapshot", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    expect(locked.state).toBe("locked");
    expect(locked.locked).toBe(true);
    expect(locked.selectedSlots).toEqual([0, 1, 2]);
  });

  it("makes the locked draw immutable (PLAN.md section 9: immutable locked draw)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await expect(updateSelection(locked.id, session, locked.revision, [3, 4, 5], true, undefined)).rejects.toThrow(ValidationError);
    await expect(updateSelection(locked.id, session, locked.revision, [0], false, undefined)).rejects.toThrow(ValidationError);
  });

  it("treats an identical re-lock as a safe no-op (PLAN.md section 3: identical retries are safe)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    const retried = await updateSelection(locked.id, session, locked.revision, [0, 1, 2], true, undefined);
    expect(retried.state).toBe("locked");
    expect(retried.selectedSlots).toEqual([0, 1, 2]);
  });

  it("requires exactly three distinct slots to lock", async () => {
    const session = await createSession();
    const status = await createReading(session);
    await expect(updateSelection(status.id, session, status.revision, [0, 1], true, undefined)).rejects.toThrow(ValidationError);
  });
});

describe("OTP request + verify", () => {
  it("only allows requesting a code once the draw is locked", async () => {
    const session = await createSession();
    const status = await createReading(session);
    await expect(requestOtp(status.id, session, status.revision, freshEmail(), "127.0.0.1")).rejects.toThrow(ValidationError);
  });

  it("verifies the correct code and grants access (happy path)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);
    expect(code).toMatch(/^\d{6}$/);

    const result = await verifyOtp(locked.id, session, code!);
    expect(result.ok).toBe(true);

    const status = await getStatus(locked.id, session);
    expect(status.state).toBe("verified");
    expect(status.resultAvailable).toBe(true);
  });

  it("rejects a wrong code and commits the attempt count before returning (PLAN.md section 6)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");

    const before = (await getStatus(locked.id, session)).pendingChallenge!.attemptsRemaining;
    const result = await verifyOtp(locked.id, session, "000000");
    expect(result.ok).toBe(false);
    const after = (await getStatus(locked.id, session)).pendingChallenge!.attemptsRemaining;
    expect(after).toBe(before - 1);
  });

  it("locks out after the max wrong attempts, even if the correct code is finally tried", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await verifyOtp(locked.id, session, "000000");
      expect(r.ok).toBe(false);
    }
    const finalTry = await verifyOtp(locked.id, session, code!);
    expect(finalTry.ok).toBe(false);
    if (!finalTry.ok) expect(finalTry.reason).toBe("attempts_exhausted");
  });

  it("supersedes the old code on resend — only the newest code verifies (PLAN.md section 9: only one active generation)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const revisionAfterFirstSend = (await getStatus(locked.id, session)).revision;
    const firstCode = await codeFor(locked.id);

    // Past the 60s resend cooldown (PLAN.md section 6).
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);

    await requestOtp(locked.id, session, revisionAfterFirstSend, freshEmail(), "127.0.0.1");
    const secondCode = await codeFor(locked.id);
    expect(secondCode).not.toBe(firstCode);

    const staleAttempt = await verifyOtp(locked.id, session, firstCode!);
    expect(staleAttempt.ok).toBe(false);

    const freshAttempt = await verifyOtp(locked.id, session, secondCode!);
    expect(freshAttempt.ok).toBe(true);
  });

  it("is idempotent on repeat verify after success (PLAN.md section 6: a lost response doesn't grant extra access)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);

    expect((await verifyOtp(locked.id, session, code!)).ok).toBe(true);
    // Repeat with a garbage code — already verified, so this must still succeed.
    expect((await verifyOtp(locked.id, session, "111111")).ok).toBe(true);
  });

  it("denies result access before verification, and permits it after (PLAN.md section 9: unverified read denied)", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await expect(getResult(locked.id, session)).rejects.toThrow(OwnershipError);

    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);
    await verifyOtp(locked.id, session, code!);

    const result = await getResult(locked.id, session);
    expect(result.cards).toHaveLength(3);
  });
});

describe("rate limiting", () => {
  it("does not spend send budgets on repeated attempts during the resend cooldown", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    const address = freshEmail();
    await requestOtp(locked.id, session, locked.revision, address, "127.0.0.1");
    for (let i = 0; i < 3; i++) {
      await expect(requestOtp(locked.id, session, locked.revision, address, "127.0.0.1")).rejects.toThrow(RateLimitedError);
    }
    const buckets = await db.select().from(rateLimitBuckets);
    expect(buckets).toHaveLength(3);
    expect(buckets.every((b) => b.count === 1)).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    expect((await requestOtp(locked.id, session, locked.revision, address, "127.0.0.1")).sendStatus).toBe("accepted");
  });

  it("blocks a fourth code request to the same address within an hour (PLAN.md: 3/hour per email)", async () => {
    const address = freshEmail();
    for (let i = 0; i < 3; i++) {
      const session = await createSession();
      const locked = await lockedReading(session);
      await requestOtp(locked.id, session, locked.revision, address, `10.0.0.${i}`);
    }
    const session = await createSession();
    const locked = await lockedReading(session);
    await expect(requestOtp(locked.id, session, locked.revision, address, "10.0.0.99")).rejects.toThrow(RateLimitedError);
  });

  it("enforces a resend cooldown on the same reading", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const afterFirst = await getStatus(locked.id, session);
    await expect(requestOtp(locked.id, session, afterFirst.revision, freshEmail(), "127.0.0.1")).rejects.toThrow(RateLimitedError);
  });
});

describe("delivery failures", () => {
  it("does not create a challenge or spend send budgets when email is misconfigured", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", undefined);
    await expect(requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1")).rejects.toThrow(emailProviders.EmailConfigurationError);
    expect((await getStatus(locked.id, session)).pendingChallenge).toBeUndefined();
    expect(await db.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.action, "otp_send_hour"))).toEqual([]);
  });

  it.each([
    ["resend_http_403", "failed"],
    ["network_error_or_timeout", "pending"],
    ["resend_invalid_response", "pending"],
  ] as const)("persists %s as %s and logs a reason without exposing the code or email", async (reason, status) => {
    const session = await createSession();
    const locked = await lockedReading(session);
    const address = freshEmail();
    const send = vi.fn().mockResolvedValue({ status: "failed", reason });
    vi.spyOn(emailProviders, "getEmailProvider").mockReturnValue({ name: "resend", sendVerificationCode: send });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    const result = await requestOtp(locked.id, session, locked.revision, address, "127.0.0.1");
    expect(result.sendStatus).toBe(status);
    expect(result.devCode).toBeUndefined();
    expect((await getStatus(locked.id, session)).pendingChallenge?.sendStatus).toBe(status);
    expect(log).toHaveBeenCalledWith("[otp_delivery]", expect.objectContaining({ failureReason: reason, sendStatus: status }));
    const code = send.mock.calls[0][0].code;
    const logs = JSON.stringify(log.mock.calls);
    expect(logs).not.toContain(address);
    expect(logs).not.toContain(code);
    if (status === "pending") expect((await verifyOtp(locked.id, session, code)).ok).toBe(true);
  });
});

describe("suppressed addresses", () => {
  it("refuses to send a code to a suppressed address", async () => {
    const address = freshEmail();
    await db.insert(suppressedEmails).values({
      id: randomId(),
      normalizedLookupHash: hashEmailForLookup(address.toLowerCase()),
      reason: "hard_bounce",
      firstSuppressedAt: Date.now(),
    });

    const session = await createSession();
    const locked = await lockedReading(session);
    await expect(requestOtp(locked.id, session, locked.revision, address, "127.0.0.1")).rejects.toThrow(ValidationError);
  });
});
