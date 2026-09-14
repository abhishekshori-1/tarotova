import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets, readingGenerations } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import { createReading, getResult, updateSelection, AccessRequiredError, OwnershipError } from "@/server/readingService";
import { confirmSessionCode, requestSessionCode } from "@/server/sessionVerification";
import { requestInterpretation } from "@/server/generation/service";
import { GENERATION_LEASE_MS, GENERATION_MAX_ATTEMPTS } from "@/server/generation/config";
import { INTERPRETATION_PROMPT_VERSION } from "@/server/generation/prompts";
import { StubProvider } from "@/server/generation/stub";
import { CARDS } from "@/content/cards";
import { deleteExpired } from "@/server/cleanup";

// Release B's contract (docs/REVIEW-V2.md findings 1, 2, 8 and the adopted
// "Leases do not guarantee one paid call"), exercised against the stub
// provider on in-memory pglite. The stub's question markers steer the
// failure paths (src/server/generation/stub.ts).

const DAY = 24 * 60 * 60 * 1000;

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * DAY });
  return id;
}

async function lockedReading(sessionId: string, question: string | null = "What should I consider before changing jobs?") {
  const draft = await createReading(sessionId, "work", question);
  return updateSelection(draft.id, sessionId, draft.revision, [0, 1, 2], true, undefined);
}

let emails = 0;
async function verifySession(sessionId: string) {
  emails += 1;
  await requestSessionCode(sessionId, `person${emails}@example.com`, "127.0.0.1");
  const code = (consoleEmailProvider as unknown as { lastCodeFor(id: string): string | undefined }).lastCodeFor(sessionId)!;
  expect((await confirmSessionCode(sessionId, code)).ok).toBe(true);
}

async function generationRow(readingId: string) {
  const [row] = await db.select().from(readingGenerations).where(eq(readingGenerations.readingId, readingId));
  return row;
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  vi.stubEnv("GENERATION_ENABLED", "true");
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

describe("flags and applicability", () => {
  it("reports disabled when the master flag is off, even for a stored answer", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    expect((await requestInterpretation(reading.id, session, "1.1.1.1")).status).toBe("succeeded");
    vi.stubEnv("GENERATION_ENABLED", "false");
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "disabled" });
    expect((await getResult(reading.id, session)).interpretation).toEqual({ status: "disabled" });
  });

  it("is not applicable without a question and never touches the provider", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, null);
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "not_applicable" });
    expect(await generationRow(reading.id)).toBeUndefined();
  });

  it("pauses guest readings alone while verified sessions keep generating", async () => {
    vi.stubEnv("GUEST_GENERATION_ENABLED", "false");
    const guest = await createSession();
    const guestReading = await lockedReading(guest);
    expect(await requestInterpretation(guestReading.id, guest, "1.1.1.1")).toEqual({ status: "unavailable", reason: "guest_paused" });
    expect(await generationRow(guestReading.id)).toBeUndefined();

    const verified = await createSession();
    await verifySession(verified);
    const verifiedReading = await lockedReading(verified);
    expect((await requestInterpretation(verifiedReading.id, verified, "1.1.1.1")).status).toBe("succeeded");
  });

  it("reports unavailable, not a fake answer, when production has no provider", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENERATION_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const session = await createSession();
    const reading = await lockedReading(session);
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "unavailable", reason: "not_configured" });
    expect(console.error).toHaveBeenCalledWith("[generation_configuration]", expect.objectContaining({ reason: expect.stringContaining("ANTHROPIC_API_KEY") }));
    expect(await generationRow(reading.id)).toBeUndefined();
  });
});

describe("authorization", () => {
  it("is a 404 for a stranger and verification_required for an unentitled owner", async () => {
    const owner = await createSession();
    const reading = await lockedReading(owner);
    await expect(requestInterpretation(reading.id, await createSession(), "1.1.1.1")).rejects.toBeInstanceOf(OwnershipError);

    // The owner's free reading is spent; a second lock gets no grant.
    const second = await lockedReading(owner);
    expect(second.entitlement).toBe("verification_required");
    await expect(requestInterpretation(second.id, owner, "1.1.1.1")).rejects.toBeInstanceOf(AccessRequiredError);
    expect(await generationRow(second.id)).toBeUndefined();
  });
});

describe("the happy path", () => {
  it("generates once, stores the validated answer and is idempotent afterwards", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const first = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(first.status).toBe("succeeded");
    if (first.status !== "succeeded") return;
    expect(first.answer.cards.map((c) => c.position)).toEqual(["situation", "challenge", "guidance"]);
    expect(first.answer.beyondSpread).toBeNull();
    expect(first.promptVersion).toBe(INTERPRETATION_PROMPT_VERSION);

    const row = await generationRow(reading.id);
    expect(row.status).toBe("succeeded");
    expect(row.attempts).toBe(1);
    expect(row.safetyCategory).toBe("none");

    const again = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(again).toEqual(first);
    expect((await generationRow(reading.id)).attempts).toBe(1);
    expect((await getResult(reading.id, session)).interpretation).toEqual(first);
  });

  it("routes a crisis question to the authored response without an answer call", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "I don't want to be here anymore. Is there any point?");
    const view = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(view.status).toBe("refused");
    if (view.status !== "refused") return;
    expect(view.category).toBe("crisis");
    expect(view.response.heading).toMatch(/bigger than a card reading/);
    expect(view.response.resources.map((r) => r.label)).toContain("Find a helpline");
    const row = await generationRow(reading.id);
    expect(row.status).toBe("refused");
    expect(row.output).toBeNull();
    // Stable across reads and re-requests.
    expect((await getResult(reading.id, session)).interpretation).toEqual(view);
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual(view);
  });
});

describe("reading quality and safety handoffs", () => {
  it("passes the classified emotional context to the writer", async () => {
    const spy = vi.spyOn(StubProvider.prototype, "interpret");
    const session = await createSession();
    const reading = await lockedReading(session, "I was laid off. What now?");
    await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ safetyCategory: "stressful" }), expect.objectContaining({ deadlineAt: expect.any(Number) }));
  });

  it("exposes completed triage while the answer is pending, then keeps it on failure", async () => {
    let resolveClassification!: (value: { ok: true; value: "stressful"; model: string }) => void;
    const classify = vi.spyOn(StubProvider.prototype, "classify").mockImplementation(() => new Promise((resolve) => { resolveClassification = resolve; }));
    let resolveAnswer!: (value: { ok: false; reason: string; retryable: boolean; uncertain: boolean }) => void;
    const interpret = vi.spyOn(StubProvider.prototype, "interpret").mockImplementation(() => new Promise((resolve) => { resolveAnswer = resolve; }));
    const session = await createSession();
    const reading = await lockedReading(session);
    const generating = requestInterpretation(reading.id, session, "1.1.1.1");
    await vi.waitFor(() => expect(classify).toHaveBeenCalled());
    expect((await getResult(reading.id, session)).interpretation).toEqual({ status: "pending" });
    resolveClassification({ ok: true, value: "stressful", model: "test" });
    await vi.waitFor(() => expect(interpret).toHaveBeenCalled());
    expect((await getResult(reading.id, session)).interpretation).toEqual({ status: "pending", classifiedCategory: "stressful" });
    resolveAnswer({ ok: false, reason: "provider_http_400", retryable: false, uncertain: false });
    expect(await generating).toMatchObject({ status: "failed", classifiedCategory: "stressful" });
    expect((await getResult(reading.id, session)).interpretation).toMatchObject({ status: "failed", classifiedCategory: "stressful" });
  });

  it("does not claim or spend when the request deadline is already exhausted", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const spy = vi.spyOn(StubProvider.prototype, "classify");
    expect(await requestInterpretation(reading.id, session, "1.1.1.1", { deadlineAt: Date.now() - 1 })).toEqual({ status: "failed", reason: "request_deadline", retryable: true });
    expect(await generationRow(reading.id)).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the core meaning frozen when the library changes after locking", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const result = await getResult(reading.id, session);
    const card = CARDS.find((c) => c.id === result.cards[0].id)!;
    const original = card.coreMeaning;
    const spy = vi.spyOn(StubProvider.prototype, "interpret");
    try {
      card.coreMeaning = "A later editorial revision.";
      await requestInterpretation(reading.id, session, "1.1.1.1");
      expect(spy.mock.calls[0][0].cards[0].coreMeaning).toBe(original);
    } finally {
      card.coreMeaning = original;
    }
  });

  it("retains a support response when generation is switched off", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "I don't want to be here anymore.");
    const view = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(view.status).toBe("refused");
    vi.stubEnv("GENERATION_ENABLED", "false");
    expect((await getResult(reading.id, session)).interpretation).toEqual(view);
  });

  it("does not generate after a crash between recording triage and completing refusal", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const spy = vi.spyOn(StubProvider.prototype, "interpret");
    const t = Date.now() - GENERATION_LEASE_MS - 1;
    await db.insert(readingGenerations).values({
      id: randomId(), readingId: reading.id, kind: "interpretation", status: "provider_called",
      attempts: 1, leaseExpiresAt: t + GENERATION_LEASE_MS, safetyCategory: "crisis",
      promptVersion: "interpretation.v1", contentVersion: "content.v1-draft", createdAt: t, updatedAt: t,
    });
    expect((await requestInterpretation(reading.id, session, "1.1.1.1")).status).toBe("refused");
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not retry a provider content refusal on a later request", async () => {
    const spy = vi.spyOn(StubProvider.prototype, "interpret").mockResolvedValue({ ok: false, reason: "provider_blocked", retryable: false, uncertain: false });
    const session = await createSession();
    const reading = await lockedReading(session);
    const first = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(first).toEqual({ status: "failed", reason: "provider_blocked", retryable: false, classifiedCategory: "none" });
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("attempts, retries and leases", () => {
  it("caps paid attempts at two and then fails for good", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "What now? [stub:fail]");
    const view = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(view).toEqual({ status: "failed", reason: "provider_http_529", retryable: false, classifiedCategory: "none" });
    const row = await generationRow(reading.id);
    expect(row.attempts).toBe(GENERATION_MAX_ATTEMPTS);
    // A later request spends nothing more.
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual(view);
    expect((await generationRow(reading.id)).attempts).toBe(GENERATION_MAX_ATTEMPTS);
  });

  it("counts an uncertain (timed-out) call as a spent attempt", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "What now? [stub:uncertain]");
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "failed", reason: "provider_timeout", retryable: false, classifiedCategory: "none" });
    expect((await generationRow(reading.id)).attempts).toBe(2);
  });

  it("never stores output that fails validation", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "What now? [stub:invalid]");
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "failed", reason: "output_invalid:foreign_card", retryable: false, classifiedCategory: "none" });
    expect((await generationRow(reading.id)).output).toBeNull();
  });

  it("lets only one of two concurrent requests do the work; the other sees pending", async () => {
    const session = await createSession();
    const reading = await lockedReading(session, "What now? [stub:slow]");
    const [a, b] = await Promise.all([requestInterpretation(reading.id, session, "1.1.1.1"), requestInterpretation(reading.id, session, "1.1.1.1")]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["pending", "succeeded"]);
    expect((await generationRow(reading.id)).attempts).toBe(1);
  });

  it("reclaims a lost lease without exceeding the cap", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const t = Date.now();
    // A request that died mid-call: attempt recorded, no result, lease still live.
    await db.insert(readingGenerations).values({
      id: randomId(),
      readingId: reading.id,
      kind: "interpretation",
      status: "provider_called",
      attempts: 1,
      leaseExpiresAt: t + GENERATION_LEASE_MS,
      promptVersion: "interpretation.v1",
      contentVersion: "content.v1-draft",
      createdAt: t,
      updatedAt: t,
    });
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "pending" });

    vi.useFakeTimers();
    vi.setSystemTime(t + GENERATION_LEASE_MS + 1);
    const view = await requestInterpretation(reading.id, session, "1.1.1.1");
    expect(view.status).toBe("succeeded");
    expect((await generationRow(reading.id)).attempts).toBe(2);
    expect((await generationRow(reading.id)).promptVersion).toBe(INTERPRETATION_PROMPT_VERSION);
  });

  it("treats a lost lease with no attempts left as exhausted", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    const t = Date.now() - GENERATION_LEASE_MS - 1;
    await db.insert(readingGenerations).values({
      id: randomId(),
      readingId: reading.id,
      kind: "interpretation",
      status: "provider_called",
      attempts: GENERATION_MAX_ATTEMPTS,
      leaseExpiresAt: t + GENERATION_LEASE_MS,
      promptVersion: "interpretation.v1",
      contentVersion: "content.v1-draft",
      createdAt: t,
      updatedAt: t,
    });
    expect(await requestInterpretation(reading.id, session, "1.1.1.1")).toEqual({ status: "failed", reason: "attempts_exhausted", retryable: false });
  });
});

describe("budgets", () => {
  it("reserves the session budget before calling the provider and parks the reading until the window turns", async () => {
    vi.stubEnv("GENERATION_LIMIT_SESSION_DAY", "1");
    const session = await createSession();
    await verifySession(session);
    const first = await lockedReading(session);
    expect((await requestInterpretation(first.id, session, "1.1.1.1")).status).toBe("succeeded");

    const second = await lockedReading(session);
    const view = await requestInterpretation(second.id, session, "1.1.1.1");
    expect(view).toMatchObject({ status: "unavailable", reason: "busy" });
    if (view.status !== "unavailable") return;
    expect(view.retryAfterSeconds).toBeGreaterThan(0);
    const row = await generationRow(second.id);
    expect(row.attempts).toBe(0);
    expect(row.errorReason).toBe("budget_exhausted");
    expect((await getResult(second.id, session)).interpretation).toMatchObject({ status: "unavailable", reason: "busy" });

    // After the window it is simply retryable — no attempt was spent.
    vi.stubEnv("GENERATION_LIMIT_SESSION_DAY", "10");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + DAY);
    expect((await requestInterpretation(second.id, session, "1.1.1.1")).status).toBe("succeeded");
  });

  it("enforces the global daily cap across sessions and IPs", async () => {
    vi.stubEnv("GENERATION_LIMIT_GLOBAL_DAY", "1");
    const a = await createSession();
    const b = await createSession();
    expect((await requestInterpretation((await lockedReading(a)).id, a, "1.1.1.1")).status).toBe("succeeded");
    expect(await requestInterpretation((await lockedReading(b)).id, b, "2.2.2.2")).toMatchObject({ status: "unavailable", reason: "busy" });
  });
});

describe("retention", () => {
  it("deletes the answer with its reading", async () => {
    const session = await createSession();
    const reading = await lockedReading(session);
    expect((await requestInterpretation(reading.id, session, "1.1.1.1")).status).toBe("succeeded");
    const counts = await deleteExpired(Date.now() + 31 * DAY);
    expect(counts.generations).toBeGreaterThanOrEqual(1);
    expect(await generationRow(reading.id)).toBeUndefined();
  });
});
