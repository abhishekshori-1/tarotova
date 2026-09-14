import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets, readingAccessGrants, readings, sessionEmailChallenges } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { deleteExpired } from "@/server/cleanup";
import { createReading, updateSelection } from "@/server/readingService";
import { requestSessionCode } from "@/server/sessionVerification";

const DAY = 24 * 60 * 60 * 1000;

async function createSession(ttlMs = 30 * DAY): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + ttlMs });
  return id;
}

async function count<T extends { id: unknown }>(rows: Promise<T[]>) {
  return (await rows).length;
}

beforeEach(async () => {
  // Tests in this file share one database; each starts from empty tables.
  await db.delete(readingAccessGrants);
  await db.delete(sessionEmailChallenges);
  await db.delete(readings);
  await db.delete(browserSessions);
  await db.delete(rateLimitBuckets);
});

afterEach(() => vi.restoreAllMocks());

describe("deleteExpired", () => {
  it("removes abandoned drafts and locked-but-unclaimed readings after the draft window", async () => {
    const session = await createSession();
    const granted = await createReading(session);
    await updateSelection(granted.id, session, granted.revision, [0, 1, 2], true, undefined);
    const abandoned = await createReading(session);
    const loser = await createReading(session);
    await updateSelection(loser.id, session, loser.revision, [3, 4, 5], true, undefined);

    expect((await deleteExpired()).readings).toBe(0);

    const result = await deleteExpired(Date.now() + DAY + 1000);
    expect(result.readings).toBe(2);
    expect(await count(db.select().from(readings).where(eq(readings.id, abandoned.id)))).toBe(0);
    expect(await count(db.select().from(readings).where(eq(readings.id, loser.id)))).toBe(0);
    expect(await count(db.select().from(readings).where(eq(readings.id, granted.id)))).toBe(1);
  });

  it("removes a granted reading and its grant only after its access window ends", async () => {
    const session = await createSession();
    const draft = await createReading(session);
    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    expect((await deleteExpired(Date.now() + 29 * DAY)).readings).toBe(0);
    const result = await deleteExpired(Date.now() + 31 * DAY);
    expect(result.readings).toBe(1);
    expect(result.grants).toBe(1);
    expect(await count(db.select().from(readingAccessGrants).where(eq(readingAccessGrants.readingId, draft.id)))).toBe(0);
  });

  it("removes spent session challenges, rate buckets and sessions that own nothing", async () => {
    const session = await createSession(60_000);
    await requestSessionCode(session, "gone@example.com", "127.0.0.1");
    const result = await deleteExpired(Date.now() + 2 * DAY);
    expect(result.sessionChallenges).toBeGreaterThanOrEqual(1);
    expect(result.rateLimitBuckets).toBeGreaterThanOrEqual(1);
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(await count(db.select().from(browserSessions).where(eq(browserSessions.id, session)))).toBe(0);
    expect(await count(db.select().from(sessionEmailChallenges).where(eq(sessionEmailChallenges.browserSessionId, session)))).toBe(0);
    expect(await count(db.select().from(rateLimitBuckets))).toBe(0);
  });

  it("keeps an expired session alive while it still owns a reading", async () => {
    const session = await createSession(60_000);
    const draft = await createReading(session);
    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    await deleteExpired(Date.now() + 2 * DAY);
    expect(await count(db.select().from(browserSessions).where(eq(browserSessions.id, session)))).toBe(1);
  });
});
