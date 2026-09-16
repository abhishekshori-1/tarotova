import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { browserSessions, journeyRuns, journeyTransitions, rateLimitBuckets, readingAccessGrants, readings } from "@/server/db/schema";
import { JOURNEYS } from "@/content/journeys";
import { createJourney, getJourney, advanceJourney, listJourneys } from "@/server/journeys";
import { updateSelection, createReading } from "@/server/readingService";
import { requestInterpretation } from "@/server/generation/service";
import { requestFollowup } from "@/server/generation/followups";
import { deleteExpired } from "@/server/cleanup";
import { randomId } from "@/server/ids";
import { StubProvider } from "@/server/generation/stub";
const DAY = 86400000;
async function session() { const id = randomId(); await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: Date.now(), expiresAt: Date.now() + 30 * DAY }); return id; }
async function start(sid: string, slug = JOURNEYS[0].slug, question = "What would I like to understand about this change?") { return createJourney(sid, randomId(), randomId(), slug, question); }
async function lock(sid: string, run: Awaited<ReturnType<typeof start>>) { return updateSelection(run.readingId, sid, run.reading.revision, [0, 1, 2], true, undefined); }
beforeEach(() => { vi.stubEnv("JOURNEYS_ENABLED", "true"); vi.stubEnv("GENERATION_ENABLED", "false"); vi.stubEnv("GENERATION_PROVIDER", "stub"); vi.stubEnv("GENERATION_REVIEW_PROVIDER", "stub"); vi.stubEnv("FOLLOWUPS_ENABLED", "true"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("creates one run and reading atomically, with free idempotent duplicate submissions", async () => {
  const sid = await session(); const submission = randomId();
  const [a, b] = await Promise.all([createJourney(sid, "create-test", submission, JOURNEYS[0].slug, "A change"), createJourney(sid, "create-test", submission, JOURNEYS[0].slug, "A change")]);
  expect(a.id).toBe(b.id); expect(a.readingId).toBe(b.readingId);
  expect(await db.select().from(readings).where(eq(readings.browserSessionId, sid))).toHaveLength(1);
  await expect(createJourney(sid, "create-test", submission, JOURNEYS[0].slug, "Changed question")).rejects.toMatchObject({ message: "revision_conflict" });
});

it.each(JOURNEYS.flatMap((j) => [false, true].map((enabled) => ({ slug: j.slug, enabled }))))("completes $slug with generation=$enabled, no notes or follow-ups, and freezes its template", async ({ slug, enabled }) => {
  vi.stubEnv("GENERATION_ENABLED", String(enabled));
  const sid = await session(); const run = await start(sid, slug); await lock(sid, run);
  if (enabled) await requestInterpretation(run.readingId, sid, "journey-test");
  const saved = await getJourney(run.id, sid); expect(saved.template).toEqual(JOURNEYS.find((j) => j.slug === slug));
  const original = JOURNEYS.find((j) => j.slug === slug)!; const title = original.title;
  original.title = "Changed after creation";
  try { expect((await getJourney(run.id, sid)).template.title).toBe(title); } finally { original.title = title; }
  const generate = vi.spyOn(StubProvider.prototype, "interpret");
  const explore = await advanceJourney(run.id, sid, 0, randomId(), "explore");
  const reflect = await advanceJourney(run.id, sid, explore.revision, randomId(), "reflect");
  const done = await advanceJourney(run.id, sid, reflect.revision, randomId(), "complete");
  expect(done.completedAt).toBeTypeOf("number"); expect(generate).not.toHaveBeenCalled();
  expect((await listJourneys(sid)).active).toHaveLength(0);
});

it("replays transitions without moving backwards and rejects competing stale transitions", async () => {
  const sid = await session(); const run = await start(sid); await lock(sid, run);
  const token = randomId(); const explore = await advanceJourney(run.id, sid, 0, token, "explore");
  const outcomes = await Promise.allSettled([advanceJourney(run.id, sid, explore.revision, randomId(), "reflect"), advanceJourney(run.id, sid, explore.revision, randomId(), "frame")]);
  expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
  const current = await getJourney(run.id, sid);
  expect((await advanceJourney(run.id, sid, 0, token, "explore")).revision).toBe(current.revision);
  await expect(advanceJourney(run.id, sid, 0, token, "frame")).rejects.toMatchObject({ message: "revision_conflict" });
});

it("enforces owner, grant and expiry without spending or drawing on a GET", async () => {
  const sid = await session(); const run = await start(sid);
  await expect(getJourney(run.id, await session())).rejects.toMatchObject({ message: "not_found" });
  await expect(advanceJourney(run.id, sid, 0, randomId(), "explore")).rejects.toMatchObject({ message: "not_found" });
  await lock(sid, run);
  const before = await db.select().from(rateLimitBuckets);
  await getJourney(run.id, sid); await getJourney(run.id, sid);
  expect(await db.select().from(rateLimitBuckets)).toEqual(before);
  await db.update(readingAccessGrants).set({ expiresAt: Date.now() - 1 }).where(eq(readingAccessGrants.readingId, run.readingId));
  await expect(getJourney(run.id, sid)).rejects.toMatchObject({ message: "not_found" });
  expect((await listJourneys(sid)).active).toHaveLength(0);
});

it("does not grant a second reading via a journey", async () => {
  const sid = await session(); const first = await createReading(sid); await updateSelection(first.id, sid, 0, [0, 1, 2], true, undefined);
  const run = await start(sid); expect(run.reading.entitlement).toBe("verification_required"); await lock(sid, run);
  await expect(advanceJourney(run.id, sid, 0, randomId(), "explore")).rejects.toMatchObject({ message: "verification_required" });
});

it("disabling journeys stops starts but permits owned runs to finish", async () => {
  const sid = await session(); const run = await start(sid); await lock(sid, run);
  vi.stubEnv("JOURNEYS_ENABLED", "false");
  await expect(start(sid)).rejects.toMatchObject({ message: "journeys_disabled" });
  expect((await listJourneys(sid)).active[0].id).toBe(run.id);
  const a = await advanceJourney(run.id, sid, 0, randomId(), "explore");
  const b = await advanceJourney(run.id, sid, a.revision, randomId(), "reflect");
  expect((await advanceJourney(run.id, sid, b.revision, randomId(), "complete")).stage).toBe("complete");
});

it("supports a classified generation outage but never bypasses unclassified content", async () => {
  vi.stubEnv("GENERATION_ENABLED", "true");
  const sid = await session(); const run = await start(sid, JOURNEYS[0].slug, "A change [stub:fail]"); await lock(sid, run);
  const a = await advanceJourney(run.id, sid, 0, randomId(), "explore");
  await expect(advanceJourney(run.id, sid, a.revision, randomId(), "reflect")).rejects.toMatchObject({ message: "reading_not_ready" });
  await requestInterpretation(run.readingId, sid, "outage-test");
  expect((await advanceJourney(run.id, sid, a.revision, randomId(), "reflect")).stage).toBe("reflect");
});

it("support closes journey prompts even when generation and journeys are disabled", async () => {
  vi.stubEnv("GENERATION_ENABLED", "true");
  const sid = await session(); const run = await start(sid); await lock(sid, run);
  await requestInterpretation(run.readingId, sid, "support-test");
  const a = await advanceJourney(run.id, sid, 0, randomId(), "explore");
  await requestFollowup(run.readingId, sid, "support-test", randomId(), "I don't want to be here anymore.");
  vi.stubEnv("GENERATION_ENABLED", "false"); vi.stubEnv("JOURNEYS_ENABLED", "false");
  expect((await getJourney(run.id, sid)).support).not.toBeNull();
  await expect(advanceJourney(run.id, sid, a.revision, randomId(), "reflect")).rejects.toMatchObject({ message: "conversation_closed" });
});

it("cleanup deletes runs and transition history with expired readings", async () => {
  const sid = await session(); const run = await start(sid); await lock(sid, run);
  await advanceJourney(run.id, sid, 0, randomId(), "explore");
  expect(await db.select().from(journeyTransitions).where(eq(journeyTransitions.journeyId, run.id))).toHaveLength(1);
  await deleteExpired(Date.now() + 32 * DAY);
  expect(await db.select().from(journeyRuns).where(eq(journeyRuns.id, run.id))).toHaveLength(0);
  expect(await db.select().from(journeyTransitions).where(eq(journeyTransitions.journeyId, run.id))).toHaveLength(0);
});

it("resume lists only the owner's live drafts and frozen titles", async () => {
  const sid = await session(); const live = await start(sid); const expired = await start(sid);
  await db.update(readings).set({ draftExpiresAt: Date.now() - 1 }).where(eq(readings.id, expired.readingId));
  await start(await session());
  const title = JOURNEYS[0].title; JOURNEYS[0].title = "Changed template";
  try { expect((await listJourneys(sid)).active).toEqual([{ id: live.id, title, stage: "frame" }]); }
  finally { JOURNEYS[0].title = title; }
});
