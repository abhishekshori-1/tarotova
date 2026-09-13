import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import { MAX_ATTEMPTS } from "@/server/otp";
import { RateLimitedError } from "@/server/errors";
import { confirmSessionCode, getSessionVerification, requestSessionCode } from "@/server/sessionVerification";
import { createReading, requestOtp, updateSelection } from "@/server/readingService";

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
});

describe("session continuation verification (docs/ACCESS-FLOW.md section 6)", () => {
  it("starts unverified and becomes verified for a fixed 30-day window", async () => {
    const session = await createSession();
    expect((await getSessionVerification(session)).verified).toBe(false);

    const sent = await requestSessionCode(session, freshEmail(), "127.0.0.1");
    expect(sent.sendStatus).toBe("accepted");
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

  it("rejects wrong, superseded and exhausted codes", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    const first = codeFor(session);
    expect(await confirmSessionCode(session, "000000")).toEqual({ ok: false, reason: "wrong_code" });
    expect((await getSessionVerification(session)).pendingChallenge?.attemptsRemaining).toBe(MAX_ATTEMPTS - 1);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    expect((await confirmSessionCode(session, first)).ok).toBe(false);

    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirmSessionCode(session, "000000");
    expect(await confirmSessionCode(session, codeFor(session))).toEqual({ ok: false, reason: "attempts_exhausted" });
    expect((await getSessionVerification(session)).verified).toBe(false);
  });

  it("never accepts a reading-bound code for the session, even from the same browser", async () => {
    const session = await createSession();
    const draft = await createReading(session);
    const locked = await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    await requestOtp(locked.id, session, locked.revision, freshEmail(), "127.0.0.1");
    const readingCode = codeFor(locked.id);
    expect(await confirmSessionCode(session, readingCode)).toEqual({ ok: false, reason: "no_active_code" });

    await requestSessionCode(session, freshEmail(), "10.0.0.2");
    expect((await confirmSessionCode(session, readingCode)).ok).toBe(false);
  });

  it("treats a repeated confirmation after success as idempotent", async () => {
    const session = await createSession();
    await requestSessionCode(session, freshEmail(), "127.0.0.1");
    const code = codeFor(session);
    expect((await confirmSessionCode(session, code)).ok).toBe(true);
    expect((await confirmSessionCode(session, code)).ok).toBe(true);
    expect((await confirmSessionCode(session, "999999")).ok).toBe(true);
  });

  it("applies the resend cooldown and shared send budgets", async () => {
    const session = await createSession();
    const address = freshEmail();
    await requestSessionCode(session, address, "127.0.0.1");
    await expect(requestSessionCode(session, address, "127.0.0.1")).rejects.toThrow(RateLimitedError);
    const buckets = await db.select().from(rateLimitBuckets);
    expect(buckets.every((b) => b.count === 1)).toBe(true);
  });
});
