import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { CARDS } from "@/content/cards";
import { CONTENT_VERSION } from "@/content/versions";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets, readings } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import {
  createReading,
  getStatus,
  getResult,
  reshuffle,
  updateContext,
  updateSelection,
  AccessRequiredError,
  ConflictError,
  OwnershipError,
  ValidationError,
} from "@/server/readingService";
import { confirmSessionCode, requestSessionCode } from "@/server/sessionVerification";

// PLAN.md section 9's "Database/API integration" row, exercised directly
// against readingService (no HTTP layer) with an in-memory pglite database
// (see tests/setup.ts and db/client.ts). Session ids are plain strings here —
// resolveSession() itself depends on next/headers and is exercised only
// inside the running app.

const DAY = 24 * 60 * 60 * 1000;

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * DAY });
  return id;
}

async function lockedReading(sessionId: string, slots: [number, number, number] = [0, 1, 2]) {
  const draft = await createReading(sessionId);
  return updateSelection(draft.id, sessionId, draft.revision, slots, true, undefined);
}

/** A session whose one email-free reading is already spent, so later locks get no grant. */
async function spentSession(): Promise<string> {
  const session = await createSession();
  await lockedReading(session);
  return session;
}

function codeFor(subjectId: string) {
  return (consoleEmailProvider as unknown as { lastCodeFor(id: string): string | undefined }).lastCodeFor(subjectId)!;
}

let email = 0;
function freshEmail() {
  email += 1;
  return `person${email}@example.com`;
}

async function verifySession(sessionId: string) {
  await requestSessionCode(sessionId, freshEmail(), "127.0.0.1");
  expect((await confirmSessionCode(sessionId, codeFor(sessionId))).ok).toBe(true);
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

  it("stores an initial focus in the same request", async () => {
    const session = await createSession();
    expect((await createReading(session, "work")).focus).toBe("work");
    expect((await createReading(session)).focus).toBe("general");
  });
});

describe("draft expiry", () => {
  it("treats a drafting reading as gone after the 24-hour draft window", async () => {
    const session = await createSession();
    const status = await createReading(session);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + DAY + 1000);
    await expect(getStatus(status.id, session)).rejects.toThrow(OwnershipError);
    await expect(updateSelection(status.id, session, status.revision, [0], false, undefined)).rejects.toThrow(OwnershipError);
  });

  it("treats a locked reading that never gained access as gone after the draft window", async () => {
    const session = await spentSession();
    const locked = await lockedReading(session);
    expect(locked.entitlement).toBe("verification_required");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + DAY + 1000);
    await expect(getStatus(locked.id, session)).rejects.toThrow(OwnershipError);
    await expect(getResult(locked.id, session)).rejects.toThrow(OwnershipError);
  });

  it("keeps a granted reading readable past the draft window while access lasts", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    expect(locked.entitlement).toBe("granted");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * DAY);
    expect((await getStatus(locked.id, session)).resultAvailable).toBe(true);
    expect((await getResult(locked.id, session)).cards).toHaveLength(3);
  });

  it("makes a granted reading unavailable once its access window ends", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * DAY);
    await expect(getResult(locked.id, session)).rejects.toThrow(OwnershipError);
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
  it("labels content with the release used at lock when a draft spans a deployment", async () => {
    const session = await createSession();
    const draft = await createReading(session, "work");
    // Persist the state of a draft created by an earlier deployment.
    await db.update(readings).set({ contentVersion: "content.previous-draft" }).where(eq(readings.id, draft.id));

    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);

    const [row] = await db.select().from(readings).where(eq(readings.id, draft.id));
    const snapshot = JSON.parse(row.resultSnapshot!);
    expect(row.contentVersion).toBe(CONTENT_VERSION);
    expect(snapshot.contentVersion).toBe(CONTENT_VERSION);
    const result = await getResult(draft.id, session);
    for (const card of result.cards) {
      const source = CARDS.find((c) => c.id === card.id)!;
      expect(card.coreMeaning).toBe(source.coreMeaning);
      expect(card.interpretation).toBe(source.position[card.position]);
      expect(card.focusNote).toBe(source.focus.work);
    }
  });

  it("preserves an earlier locked snapshot and its version on read and re-lock", async () => {
    const session = await createSession();
    const locked = await lockedReading(session);
    const [row] = await db.select().from(readings).where(eq(readings.id, locked.id));
    const snapshot = JSON.parse(row.resultSnapshot!);
    snapshot.contentVersion = "content.previous-draft";
    snapshot.overview = "An overview frozen by the earlier release.";
    snapshot.reflection = "A reflection frozen by the earlier release.";
    snapshot.cards[0].coreMeaning = "A core meaning frozen by the earlier release.";
    const frozen = JSON.stringify(snapshot);
    await db.update(readings).set({ contentVersion: snapshot.contentVersion, resultSnapshot: frozen }).where(eq(readings.id, locked.id));

    const result = await getResult(locked.id, session);
    expect(result.overview).toBe(snapshot.overview);
    expect(result.reflection).toBe(snapshot.reflection);
    expect(result.cards).toEqual(snapshot.cards);
    await updateSelection(locked.id, session, locked.revision, [0, 1, 2], true, undefined);
    const [after] = await db.select().from(readings).where(eq(readings.id, locked.id));
    expect(after.contentVersion).toBe(snapshot.contentVersion);
    expect(after.resultSnapshot).toBe(frozen);
  });

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
    expect(retried.entitlement).toBe("granted");
  });

  it("requires exactly three distinct slots to lock", async () => {
    const session = await createSession();
    const status = await createReading(session);
    await expect(updateSelection(status.id, session, status.revision, [0, 1], true, undefined)).rejects.toThrow(ValidationError);
  });

  it("rejects a stale revision on a selection update and reports the current one", async () => {
    const session = await createSession();
    const status = await createReading(session);
    const next = await updateSelection(status.id, session, status.revision, [0], false, undefined);
    try {
      await updateSelection(status.id, session, status.revision, [1], false, undefined);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as ConflictError).currentRevision).toBe(next.revision);
    }
    expect((await getStatus(status.id, session)).selectedSlots).toEqual([0]);
  });

  it("lets exactly one of two concurrent locks at the same revision win", async () => {
    const session = await createSession();
    const status = await createReading(session);
    const outcomes = await Promise.allSettled([
      updateSelection(status.id, session, status.revision, [0, 1, 2], true, undefined),
      updateSelection(status.id, session, status.revision, [3, 4, 5], true, undefined),
    ]);
    const won = outcomes.filter((o) => o.status === "fulfilled");
    const lost = outcomes.filter((o) => o.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    const winnerSlots = (won[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof updateSelection>>>).value.selectedSlots;
    const final = await getStatus(status.id, session);
    expect(final.state).toBe("locked");
    expect(final.selectedSlots).toEqual(winnerSlots);
  });
});

describe("access grants (docs/ACCESS-FLOW.md)", () => {
  it("grants the first locked reading of a session without any email", async () => {
    const session = await createSession();
    const draft = await createReading(session);
    expect(draft.entitlement).toBe("eligible");
    const locked = await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    expect(locked.entitlement).toBe("granted");
    expect(locked.resultAvailable).toBe(true);
    expect(locked.accessExpiresAt).toBeGreaterThan(Date.now());
    expect((await getResult(locked.id, session)).cards).toHaveLength(3);
  });

  it("requires verification for a second draw and leaves a locked loser without a grant", async () => {
    const session = await spentSession();
    const second = await createReading(session);
    expect(second.entitlement).toBe("verification_required");
    const locked = await updateSelection(second.id, session, second.revision, [3, 4, 5], true, undefined);
    expect(locked.state).toBe("locked");
    expect(locked.entitlement).toBe("verification_required");
    await expect(getResult(second.id, session)).rejects.toThrow(AccessRequiredError);
  });

  it("issues exactly one guest grant when two drafts in one session lock concurrently", async () => {
    const session = await createSession();
    const a = await createReading(session);
    const b = await createReading(session);
    const [ra, rb] = await Promise.all([
      updateSelection(a.id, session, a.revision, [0, 1, 2], true, undefined),
      updateSelection(b.id, session, b.revision, [3, 4, 5], true, undefined),
    ]);
    expect([ra.entitlement, rb.entitlement].sort()).toEqual(["granted", "verification_required"]);
    expect(ra.state).toBe("locked");
    expect(rb.state).toBe("locked");
  });

  it("lets a verified session claim access to its earlier locked loser on the next result read", async () => {
    const session = await spentSession();
    const second = await lockedReading(session);
    expect(second.entitlement).toBe("verification_required");
    await verifySession(session);
    expect((await getResult(second.id, session)).cards).toHaveLength(3);
    expect((await getStatus(second.id, session)).entitlement).toBe("granted");
  });

  it("grants later draws directly while session verification lasts, with no code per reading", async () => {
    const session = await spentSession();
    await verifySession(session);
    for (let i = 0; i < 2; i++) {
      const draft = await createReading(session);
      expect(draft.entitlement).toBe("eligible");
      expect(draft.sessionVerified).toBe(true);
      const locked = await updateSelection(draft.id, session, draft.revision, [6, 7, 8], true, undefined);
      expect(locked.entitlement).toBe("granted");
    }
  });

  it("re-requires verification for new draws once the verification window ends, keeping earlier grants", async () => {
    const session = await spentSession();
    await verifySession(session);
    const granted = await lockedReading(session);
    expect(granted.entitlement).toBe("granted");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 30 * DAY + 1000);
    const draft = await createReading(session);
    expect(draft.entitlement).toBe("verification_required");
    expect(draft.sessionVerified).toBe(false);
  });

  it("never lets a different browser read a granted result", async () => {
    const owner = await createSession();
    const stranger = await createSession();
    const locked = await lockedReading(owner);
    await expect(getResult(locked.id, stranger)).rejects.toThrow(OwnershipError);
    await expect(getStatus(locked.id, stranger)).rejects.toThrow(OwnershipError);
  });
});

describe("question (intention) capture", () => {
  it("stores a trimmed question at creation and returns it with the result", async () => {
    const session = await createSession();
    const draft = await createReading(session, "work", "  What should I consider before changing jobs?  ");
    expect(draft.question).toBe("What should I consider before changing jobs?");
    const locked = await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    expect((await getResult(locked.id, session)).question).toBe("What should I consider before changing jobs?");
  });

  it("is editable with a revision check while drafting and frozen at lock", async () => {
    const session = await createSession();
    const draft = await createReading(session);
    const edited = await updateContext(draft.id, session, draft.revision, "A new question");
    expect(edited.question).toBe("A new question");
    await expect(updateContext(draft.id, session, draft.revision, "stale")).rejects.toThrow(ConflictError);
    const cleared = await updateContext(draft.id, session, edited.revision, "   ");
    expect(cleared.question).toBeNull();
    const locked = await updateSelection(draft.id, session, cleared.revision, [0, 1, 2], true, undefined);
    await expect(updateContext(draft.id, session, locked.revision, "too late")).rejects.toThrow(ValidationError);
  });

  it("rejects a question over 500 characters", async () => {
    const session = await createSession();
    await expect(createReading(session, "general", "x".repeat(501))).rejects.toThrow(ValidationError);
  });
});
