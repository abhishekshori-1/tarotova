import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { browserSessions, suppressedEmails } from "@/server/db/schema";
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
// against readingService (no HTTP layer) with an in-memory SQLite database
// (see tests/setup.ts). Session ids are plain strings here — resolveSession()
// itself depends on next/headers and is exercised only inside the running app.

function createSession(): string {
  const id = randomId();
  const t = Date.now();
  db.insert(browserSessions)
    .values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * 24 * 60 * 60 * 1000 })
    .run();
  return id;
}

function lockedReading(sessionId: string, slots: [number, number, number] = [0, 1, 2]) {
  const draft = createReading(sessionId);
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

afterEach(() => {
  vi.useRealTimers();
});

describe("createReading / getStatus", () => {
  it("starts in drafting state with no cards resolved", () => {
    const session = createSession();
    const status = createReading(session);
    expect(status.state).toBe("drafting");
    expect(status.selectedSlots).toEqual([]);
    expect(status.locked).toBe(false);
    expect(status.resultAvailable).toBe(false);
  });

  it("denies access to a reading owned by a different session (PLAN.md section 9: wrong owner denied)", () => {
    const owner = createSession();
    const stranger = createSession();
    const status = createReading(owner);
    expect(() => getStatus(status.id, stranger)).toThrow(OwnershipError);
  });

  it("denies access to a reading id that doesn't exist", () => {
    const session = createSession();
    expect(() => getStatus("does-not-exist", session)).toThrow(OwnershipError);
  });
});

describe("reshuffle", () => {
  it("allows reshuffling only while the selection is empty", () => {
    const session = createSession();
    const status = createReading(session);
    const afterSelect = updateSelection(status.id, session, status.revision, [0], false, undefined);
    expect(() => reshuffle(status.id, session, afterSelect.revision)).toThrow(ValidationError);
  });

  it("rejects a stale revision (PLAN.md section 9: draft revision conflicts)", () => {
    const session = createSession();
    const status = createReading(session);
    try {
      reshuffle(status.id, session, status.revision + 1);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as ConflictError).currentRevision).toBe(status.revision);
    }
  });
});

describe("updateSelection locking", () => {
  it("locks exactly three distinct slots and freezes a result snapshot", () => {
    const session = createSession();
    const locked = lockedReading(session);
    expect(locked.state).toBe("locked");
    expect(locked.locked).toBe(true);
    expect(locked.selectedSlots).toEqual([0, 1, 2]);
  });

  it("makes the locked draw immutable (PLAN.md section 9: immutable locked draw)", () => {
    const session = createSession();
    const locked = lockedReading(session);
    expect(() => updateSelection(locked.id, session, locked.revision, [3, 4, 5], true, undefined)).toThrow(ValidationError);
    expect(() => updateSelection(locked.id, session, locked.revision, [0], false, undefined)).toThrow(ValidationError);
  });

  it("treats an identical re-lock as a safe no-op (PLAN.md section 3: identical retries are safe)", () => {
    const session = createSession();
    const locked = lockedReading(session);
    const retried = updateSelection(locked.id, session, locked.revision, [0, 1, 2], true, undefined);
    expect(retried.state).toBe("locked");
    expect(retried.selectedSlots).toEqual([0, 1, 2]);
  });

  it("requires exactly three distinct slots to lock", () => {
    const session = createSession();
    const status = createReading(session);
    expect(() => updateSelection(status.id, session, status.revision, [0, 1], true, undefined)).toThrow(ValidationError);
  });
});

describe("OTP request + verify", () => {
  it("only allows requesting a code once the draw is locked", () => {
    const session = createSession();
    const status = createReading(session);
    return expect(requestOtp(status.id, session, status.revision, freshEmail(), "127.0.0.1")).rejects.toThrow(ValidationError);
  });

  it("verifies the correct code and grants access (happy path)", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);
    expect(code).toMatch(/^\d{6}$/);

    const result = verifyOtp(locked.id, session, code!);
    expect(result.ok).toBe(true);

    const status = getStatus(locked.id, session);
    expect(status.state).toBe("verified");
    expect(status.resultAvailable).toBe(true);
  });

  it("rejects a wrong code and commits the attempt count before returning (PLAN.md section 6)", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");

    const before = getStatus(locked.id, session).pendingChallenge!.attemptsRemaining;
    const result = verifyOtp(locked.id, session, "000000");
    expect(result.ok).toBe(false);
    const after = getStatus(locked.id, session).pendingChallenge!.attemptsRemaining;
    expect(after).toBe(before - 1);
  });

  it("locks out after the max wrong attempts, even if the correct code is finally tried", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = verifyOtp(locked.id, session, "000000");
      expect(r.ok).toBe(false);
    }
    const finalTry = verifyOtp(locked.id, session, code!);
    expect(finalTry.ok).toBe(false);
    if (!finalTry.ok) expect(finalTry.reason).toBe("attempts_exhausted");
  });

  it("supersedes the old code on resend — only the newest code verifies (PLAN.md section 9: only one active generation)", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const revisionAfterFirstSend = getStatus(locked.id, session).revision;
    const firstCode = await codeFor(locked.id);

    // Past the 60s resend cooldown (PLAN.md section 6).
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);

    await requestOtp(locked.id, session, revisionAfterFirstSend, freshEmail(), "127.0.0.1");
    const secondCode = await codeFor(locked.id);
    expect(secondCode).not.toBe(firstCode);

    const staleAttempt = verifyOtp(locked.id, session, firstCode!);
    expect(staleAttempt.ok).toBe(false);

    const freshAttempt = verifyOtp(locked.id, session, secondCode!);
    expect(freshAttempt.ok).toBe(true);
  });

  it("is idempotent on repeat verify after success (PLAN.md section 6: a lost response doesn't grant extra access)", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);

    expect(verifyOtp(locked.id, session, code!).ok).toBe(true);
    // Repeat with a garbage code — already verified, so this must still succeed.
    expect(verifyOtp(locked.id, session, "111111").ok).toBe(true);
  });

  it("denies result access before verification, and permits it after (PLAN.md section 9: unverified read denied)", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    expect(() => getResult(locked.id, session)).toThrow(OwnershipError);

    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const code = await codeFor(locked.id);
    verifyOtp(locked.id, session, code!);

    const result = getResult(locked.id, session);
    expect(result.cards).toHaveLength(3);
  });
});

describe("rate limiting", () => {
  it("blocks a fourth code request to the same address within an hour (PLAN.md: 3/hour per email)", async () => {
    const address = freshEmail();
    for (let i = 0; i < 3; i++) {
      const session = createSession();
      const locked = lockedReading(session);
      await requestOtp(locked.id, session, locked.revision, address, `10.0.0.${i}`);
    }
    const session = createSession();
    const locked = lockedReading(session);
    await expect(requestOtp(locked.id, session, locked.revision, address, "10.0.0.99")).rejects.toThrow(RateLimitedError);
  });

  it("enforces a resend cooldown on the same reading", async () => {
    const session = createSession();
    const locked = lockedReading(session);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const afterFirst = getStatus(locked.id, session);
    await expect(requestOtp(locked.id, session, afterFirst.revision, freshEmail(), "127.0.0.1")).rejects.toThrow(RateLimitedError);
  });
});

describe("suppressed addresses", () => {
  it("refuses to send a code to a suppressed address", async () => {
    const address = freshEmail();
    db.insert(suppressedEmails)
      .values({
        id: randomId(),
        normalizedLookupHash: hashEmailForLookup(address.toLowerCase()),
        reason: "hard_bounce",
        firstSuppressedAt: Date.now(),
      })
      .run();

    const session = createSession();
    const locked = lockedReading(session);
    await expect(requestOtp(locked.id, session, locked.revision, address, "127.0.0.1")).rejects.toThrow(ValidationError);
  });
});
