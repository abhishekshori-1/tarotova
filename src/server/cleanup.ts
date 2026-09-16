import { and, eq, inArray, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { browserSessions, journeyRuns, deliveryEvents, rateLimitBuckets, readingAccessGrants, readingFollowups, readingGenerations, readings, sessionEmailChallenges } from "./db/schema";

const DELIVERY_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // PLAN.md section 7

/**
 * Deletes what the retention policy says is gone (PLAN.md section 7,
 * docs/ACCESS-FLOW.md section 5): drafts past their window, readings whose
 * access has ended, spent challenges and rate buckets, and sessions that own
 * nothing anymore. Idempotent; safe to run from any scheduler.
 */
export async function deleteExpired(now = Date.now()) {
  const activeGrant = db
    .select({ id: readingAccessGrants.id })
    .from(readingAccessGrants)
    .where(and(eq(readingAccessGrants.readingId, readings.id), sql`${readingAccessGrants.expiresAt} > ${now}`));
  const expiredReadings = await db
    .select({ id: readings.id })
    .from(readings)
    .where(and(lte(readings.draftExpiresAt, now), or(isNull(readings.accessExpiresAt), lte(readings.accessExpiresAt, now)), notExists(activeGrant)));
  const readingIds = expiredReadings.map((r) => r.id);

  let grants = 0;
  let generations = 0;
  let followups = 0;
  let journeys = 0;
  if (readingIds.length > 0) {
    journeys = (await db.delete(journeyRuns).where(inArray(journeyRuns.readingId, readingIds)).returning({ id: journeyRuns.id })).length;
    followups += (await db.delete(readingFollowups).where(inArray(readingFollowups.readingId, readingIds)).returning({ id: readingFollowups.id })).length;
    grants += (await db.delete(readingAccessGrants).where(inArray(readingAccessGrants.readingId, readingIds)).returning({ id: readingAccessGrants.id })).length;
    // The question's answer leaves with the question (docs/PLAN-EXTENDED.md section 9 retention).
    generations += (await db.delete(readingGenerations).where(inArray(readingGenerations.readingId, readingIds)).returning({ id: readingGenerations.id })).length;
    await db.delete(readings).where(inArray(readings.id, readingIds));
  }
  const sessionChallengesDeleted = (await db.delete(sessionEmailChallenges).where(lte(sessionEmailChallenges.expiresAt, now)).returning({ id: sessionEmailChallenges.id })).length;
  const buckets = (await db.delete(rateLimitBuckets).where(lte(rateLimitBuckets.expiresAt, now)).returning({ id: rateLimitBuckets.id })).length;
  const events = (await db.delete(deliveryEvents).where(lte(deliveryEvents.occurredAt, now - DELIVERY_EVENT_RETENTION_MS)).returning({ id: deliveryEvents.id })).length;

  const ownsReading = db.select({ id: readings.id }).from(readings).where(eq(readings.browserSessionId, browserSessions.id));
  const expiredSessions = await db
    .select({ id: browserSessions.id })
    .from(browserSessions)
    .where(and(lte(browserSessions.expiresAt, now), notExists(ownsReading)));
  const sessionIds = expiredSessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    await db.delete(sessionEmailChallenges).where(inArray(sessionEmailChallenges.browserSessionId, sessionIds));
    await db.delete(readingAccessGrants).where(inArray(readingAccessGrants.browserSessionId, sessionIds));
    await db.delete(browserSessions).where(inArray(browserSessions.id, sessionIds));
  }

  return {
    readings: readingIds.length,
    sessionChallenges: sessionChallengesDeleted,
    grants,
    generations,
    followups,
    journeys,
    rateLimitBuckets: buckets,
    deliveryEvents: events,
    sessions: sessionIds.length,
  };
}
