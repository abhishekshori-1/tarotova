import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets, readingFollowups } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import { createReading, updateSelection, OwnershipError } from "@/server/readingService";
import { confirmSessionCode, requestSessionCode } from "@/server/sessionVerification";
import { requestInterpretation } from "@/server/generation/service";
import { listFollowups, requestFollowup } from "@/server/generation/followups";
import { FOLLOWUP_ALLOWANCE, GENERATION_LEASE_MS, GENERATION_MAX_ATTEMPTS } from "@/server/generation/config";
import { StubProvider } from "@/server/generation/stub";
import { ValidationError } from "@/server/errors";
import { deleteExpired } from "@/server/cleanup";

// Release C1's contract (docs/RELEASE-C.md sections 2–4) against the stub
// provider on in-memory pglite: slots, idempotency, in-flight, refusal,
// retries and budgets. The stub's question markers steer failure paths.

const DAY = 24 * 60 * 60 * 1000;
let n = 0;
const sid = () => `sub_${(++n).toString().padStart(6, "0")}`;

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * DAY });
  return id;
}

async function verifySession(sessionId: string) {
  await requestSessionCode(sessionId, `person${randomId(4)}@example.com`, "127.0.0.1");
  const code = (consoleEmailProvider as unknown as { lastCodeFor(id: string): string | undefined }).lastCodeFor(sessionId)!;
  expect((await confirmSessionCode(sessionId, code)).ok).toBe(true);
}

/** A locked, granted reading with its initial answer already generated (or none, for a general reading). */
async function readyReading(sessionId: string, question: string | null = "What should I consider before changing jobs?") {
  const draft = await createReading(sessionId, "work", question);
  const locked = await updateSelection(draft.id, sessionId, draft.revision, [0, 1, 2], true, undefined);
  if (question) expect((await requestInterpretation(locked.id, sessionId, "1.1.1.1")).status).toBe("succeeded");
  return locked.id;
}

async function rows(readingId: string) {
  return db.select().from(readingFollowups).where(eq(readingFollowups.readingId, readingId));
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("FOLLOWUPS_ENABLED", "true");
  vi.stubEnv("GUEST_GENERATION_ENABLED", "true");
  vi.stubEnv("GENERATION_PROVIDER", "stub");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("gates", () => {
  it("is disabled unless both the master flag and the follow-ups flag are on", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    vi.stubEnv("FOLLOWUPS_ENABLED", "false");
    expect(await listFollowups(id, session)).toMatchObject({ status: "disabled", available: false });
    await expect(requestFollowup(id, session, "1.1.1.1", sid(), "How do these connect?")).rejects.toBeInstanceOf(ValidationError);
    vi.stubEnv("FOLLOWUPS_ENABLED", "true");
    vi.stubEnv("GENERATION_ENABLED", "false");
    expect((await listFollowups(id, session)).status).toBe("disabled");
  });

  it("waits for the initial answer on a question reading, and closes after a support response", async () => {
    const session = await createSession();
    const draft = await createReading(session, "work", "A question");
    const locked = await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    expect(await listFollowups(locked.id, session)).toMatchObject({ status: "ready", available: false, reason: "initial_not_ready" });
    await expect(requestFollowup(locked.id, session, "1.1.1.1", sid(), "x")).rejects.toMatchObject({ code: "initial_not_ready" });

    const other = await createSession();
    const refused = await createReading(other, "work", "I don't want to be here anymore.");
    const lockedRefused = await updateSelection(refused.id, other, refused.revision, [0, 1, 2], true, undefined);
    expect((await requestInterpretation(lockedRefused.id, other, "1.1.1.1")).status).toBe("refused");
    expect(await listFollowups(lockedRefused.id, other)).toMatchObject({ available: false, reason: "conversation_closed" });
  });

  it("is a 404 for a stranger and allows a general reading with no question", async () => {
    const session = await createSession();
    const id = await readyReading(session, null);
    await expect(listFollowups(id, await createSession())).rejects.toBeInstanceOf(OwnershipError);
    expect(await listFollowups(id, session)).toMatchObject({ status: "ready", available: true, remaining: FOLLOWUP_ALLOWANCE });
    const view = await requestFollowup(id, session, "1.1.1.1", sid(), "What might the challenge card mean for me?");
    expect(view.turns[0]).toMatchObject({ status: "succeeded", sequence: 1 });
    expect((view.turns[0] as { answer: { paragraphs: string[] } }).answer.paragraphs[1]).toContain("a reading with no question");
  });

  it("pauses guest readings alone", async () => {
    vi.stubEnv("GUEST_GENERATION_ENABLED", "false");
    const guest = await createSession();
    const draft = await createReading(guest, "work", null);
    const locked = await updateSelection(draft.id, guest, draft.revision, [0, 1, 2], true, undefined);
    expect(await listFollowups(locked.id, guest)).toMatchObject({ available: false, reason: "guest_paused" });
  });
});

describe("turns", () => {
  it("accepts up to three turns, each seeing the earlier ones, then ends the conversation", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const spy = vi.spyOn(StubProvider.prototype, "followup");
    for (let i = 1; i <= FOLLOWUP_ALLOWANCE; i++) {
      const view = await requestFollowup(id, session, "1.1.1.1", sid(), `Follow-up number ${i}`);
      expect(view.turns).toHaveLength(i);
      expect(view.turns[i - 1]).toMatchObject({ status: "succeeded", sequence: i, text: `Follow-up number ${i}` });
      expect(view.remaining).toBe(FOLLOWUP_ALLOWANCE - i);
    }
    const last = spy.mock.calls[2][0];
    expect(last.priorTurns.map((t) => t.user)).toEqual(["Follow-up number 1", "Follow-up number 2"]);
    expect(last.priorTurns.every((t) => t.assistant !== null)).toBe(true);
    expect(last.initialAnswer).not.toBeNull();
    expect(last.originalQuestion).toBe("What should I consider before changing jobs?");
    const view = await listFollowups(id, session);
    expect(view).toMatchObject({ available: false, reason: "allowance_exhausted", remaining: 0 });
    await expect(requestFollowup(id, session, "1.1.1.1", sid(), "A fourth")).rejects.toMatchObject({ code: "allowance_exhausted" });
    expect(await rows(id)).toHaveLength(3);
  });

  it("is idempotent on the submission id and conflicts on a different text", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const spy = vi.spyOn(StubProvider.prototype, "followup");
    const submissionId = sid();
    const first = await requestFollowup(id, session, "1.1.1.1", submissionId, "How do these cards connect?");
    const again = await requestFollowup(id, session, "1.1.1.1", submissionId, "How do these cards connect?");
    expect(again).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(requestFollowup(id, session, "1.1.1.1", submissionId, "Something else")).rejects.toMatchObject({ code: "submission_conflict" });
    expect((await rows(id))[0].text).toBe("How do these cards connect?");
  });

  it("blocks a different submission while a turn is in flight", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const slow = requestFollowup(id, session, "1.1.1.1", sid(), "Take your time [stub:slow]");
    await new Promise((r) => setTimeout(r, 50));
    await expect(requestFollowup(id, session, "1.1.1.1", sid(), "Another one")).rejects.toMatchObject({ code: "turn_in_flight" });
    const view = await slow;
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0].status).toBe("succeeded");
  });

  it("classifies the latest message with the earlier ones, and a support response closes the conversation", async () => {
    const session = await createSession();
    const id = await readyReading(session, "I've been feeling flat since winter.");
    const classify = vi.spyOn(StubProvider.prototype, "classify");
    await requestFollowup(id, session, "1.1.1.1", sid(), "My doctor put me on antidepressants last month.");
    // On its own "should I stop taking it?" has no keyword; with context the stub routes it medical.
    const view = await requestFollowup(id, session, "1.1.1.1", sid(), "Should I stop taking it?");
    expect(classify).toHaveBeenLastCalledWith("Should I stop taking it?", expect.anything(), {
      originalQuestion: "I've been feeling flat since winter.",
      priorUserMessages: ["My doctor put me on antidepressants last month."],
    });
    expect(view.turns[1]).toMatchObject({ status: "refused", category: "medical" });
    expect(view.turns[1]).toHaveProperty("response.heading");
    expect(view).toMatchObject({ available: false, reason: "conversation_closed" });
    await expect(requestFollowup(id, session, "1.1.1.1", sid(), "Ok then, how do the cards connect?")).rejects.toMatchObject({ code: "conversation_closed" });
    // The earlier turns stay stored and readable.
    expect((await listFollowups(id, session)).turns[0].status).toBe("succeeded");
  });

  it("spends a slot on a failed turn, allows one retry with the same id, and caps paid attempts", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const submissionId = sid();
    const failed = await requestFollowup(id, session, "1.1.1.1", submissionId, "What now? [stub:fail]");
    expect(failed.turns[0]).toMatchObject({ status: "failed", reason: "provider_http_529", retryable: false });
    expect((await rows(id))[0].attempts).toBe(GENERATION_MAX_ATTEMPTS);
    expect(failed.remaining).toBe(FOLLOWUP_ALLOWANCE - 1);
    // A retry with the same id spends nothing more; the slot is used.
    const again = await requestFollowup(id, session, "1.1.1.1", submissionId, "What now? [stub:fail]");
    expect(again.turns[0]).toMatchObject({ status: "failed" });
    expect((await rows(id))[0].attempts).toBe(GENERATION_MAX_ATTEMPTS);
    expect(again.available).toBe(true);
  });

  it("reclaims a lost lease on the same submission without exceeding the cap", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const t = Date.now();
    await db.insert(readingFollowups).values({
      id: randomId(), readingId: id, submissionId: "sub_lost0001", sequence: 1, text: "A lost turn", status: "provider_called",
      attempts: 1, leaseExpiresAt: t + GENERATION_LEASE_MS, promptVersion: "followup.v1", reviewVersion: "grounding-followup.v1", contentVersion: "content.v8-draft", createdAt: t, updatedAt: t,
    });
    expect((await listFollowups(id, session)).turns[0].status).toBe("pending");
    vi.useFakeTimers();
    vi.setSystemTime(t + GENERATION_LEASE_MS + 1);
    expect((await listFollowups(id, session)).turns[0]).toMatchObject({ status: "failed", reason: "lease_expired", retryable: true });
    const view = await requestFollowup(id, session, "1.1.1.1", "sub_lost0001", "A lost turn");
    expect(view.turns[0].status).toBe("succeeded");
    expect((await rows(id))[0].attempts).toBe(2);
  });

  it("never stores a follow-up that fails validation", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    const view = await requestFollowup(id, session, "1.1.1.1", sid(), "Tell me more [stub:invalid]");
    expect(view.turns[0]).toMatchObject({ status: "failed", reason: "output_invalid:foreign_card" });
    expect((await rows(id))[0].output).toBeNull();
  });
});

describe("budgets and retention", () => {
  it("shares the daily generation budget with readings and reserves no slot when denied", async () => {
    vi.stubEnv("GENERATION_LIMIT_SESSION_DAY", "1");
    const session = await createSession();
    await verifySession(session);
    const id = await readyReading(session); // the reading's own answer spent the one unit
    await expect(requestFollowup(id, session, "1.1.1.1", sid(), "One more?")).rejects.toMatchObject({ code: "busy" });
    expect(await rows(id)).toHaveLength(0);
    expect((await listFollowups(id, session)).remaining).toBe(FOLLOWUP_ALLOWANCE);
  });

  it("deletes turns with their reading", async () => {
    const session = await createSession();
    const id = await readyReading(session);
    await requestFollowup(id, session, "1.1.1.1", sid(), "How do these connect?");
    const counts = await deleteExpired(Date.now() + 31 * DAY);
    expect(counts.followups).toBeGreaterThanOrEqual(1);
    expect(await rows(id)).toHaveLength(0);
  });
});
