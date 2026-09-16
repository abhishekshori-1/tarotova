import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "./db/client";
import { browserSessions, journeyRuns, journeyTransitions, readingAccessGrants, readingFollowups, readings } from "./db/schema";
import { type Executor, getGrant, isActive } from "./access";
import { ConflictError, OwnershipError, RateLimitedError, ValidationError } from "./errors";
import { randomId } from "./ids";
import { insertDraftReading, loadGrantedReading, safeStatus } from "./readingService";
import { checkAndIncrement } from "./rateLimit";
import { journeyTemplate, type JourneyStage, type JourneyTemplate } from "@/content/journeys";
import { getGeneration, viewOf } from "./generation/store";
import { canShowCardReading } from "@/lib/interpretationProgress";
import { isRefusalCategory, SAFETY_RESPONSES, type SafetyCategory } from "@/content/safety";

export function journeysEnabled() { return process.env.JOURNEYS_ENABLED === "true"; }

async function owned(ex: Executor, id: string, sessionId: string) {
  const [run] = await ex.select().from(journeyRuns).where(and(eq(journeyRuns.id, id), eq(journeyRuns.browserSessionId, sessionId))).limit(1);
  if (!run) throw new OwnershipError();
  const [reading] = await ex.select().from(readings).where(eq(readings.id, run.readingId)).limit(1);
  if (!reading || reading.browserSessionId !== sessionId) throw new OwnershipError();
  const grant = await getGrant(ex, reading.id);
  // The reading's grant is the only expiry clock; a run never extends it.
  if (grant ? !isActive(grant, Date.now()) : reading.draftExpiresAt <= Date.now()) throw new OwnershipError();
  return { run, reading, grant };
}

async function state(ex: Executor, reading: typeof readings.$inferSelect, grant?: Awaited<ReturnType<typeof getGrant>>) {
  const generation = await getGeneration(ex, reading.id);
  const turns = await ex.select().from(readingFollowups).where(eq(readingFollowups.readingId, reading.id)).orderBy(desc(readingFollowups.sequence));
  const category = turns.find((t) => t.safetyCategory && isRefusalCategory(t.safetyCategory as SafetyCategory))?.safetyCategory ?? generation?.safetyCategory;
  const support = category && isRefusalCategory(category as SafetyCategory) ? SAFETY_RESPONSES[category as keyof typeof SAFETY_RESPONSES] : null;
  const pending = turns.some((t) => (t.status === "pending" || t.status === "provider_called") && t.leaseExpiresAt > Date.now());
  return { support, canReflect: !!grant && !support && !pending && canShowCardReading(viewOf(generation, grant.basis, reading.question, Date.now())) };
}

export async function getJourney(id: string, sessionId: string) {
  const { run, reading, grant } = await owned(db, id, sessionId);
  const current = await state(db, reading, grant);
  return {
    id: run.id, readingId: run.readingId, stage: run.stage as JourneyStage, revision: run.revision,
    template: JSON.parse(run.templateSnapshot) as JourneyTemplate, completedAt: run.completedAt,
    expiresAt: grant?.expiresAt ?? reading.draftExpiresAt, reading: await safeStatus(reading, sessionId),
    ...current,
  };
}
export type JourneyView = Awaited<ReturnType<typeof getJourney>>;

export async function listJourneys(sessionId: string) {
  // Resume needs only a title and stage, not the full reading, triage or conversation.
  // One query also avoids missing live runs behind expired/completed recent entries.
  const runs = await db.select({ id: journeyRuns.id, snapshot: journeyRuns.templateSnapshot, stage: journeyRuns.stage })
    .from(journeyRuns)
    .innerJoin(readings, and(eq(readings.id, journeyRuns.readingId), eq(readings.browserSessionId, sessionId)))
    .leftJoin(readingAccessGrants, eq(readingAccessGrants.readingId, readings.id))
    .where(and(eq(journeyRuns.browserSessionId, sessionId), isNull(journeyRuns.completedAt),
      or(gt(readingAccessGrants.expiresAt, Date.now()), and(isNull(readingAccessGrants.id), gt(readings.draftExpiresAt, Date.now())))))
    .orderBy(desc(journeyRuns.updatedAt)).limit(3);
  const active = runs.map((r) => ({ id: r.id, title: (JSON.parse(r.snapshot) as JourneyTemplate).title, stage: r.stage as JourneyStage }));
  return { enabled: journeysEnabled(), active };
}

export async function createJourney(sessionId: string, ip: string, submissionId: string, slug: string, question: string) {
  const trimmed = question.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId) || !trimmed || trimmed.length > 500) throw new ValidationError("invalid_request");
  const id = await db.transaction(async (tx) => {
    // Serialize creation before looking up idempotency, including concurrent POSTs.
    const [session] = await tx.select().from(browserSessions).where(eq(browserSessions.id, sessionId)).for("update");
    if (!session || session.expiresAt <= Date.now()) throw new OwnershipError();
    const [existing] = await tx.select().from(journeyRuns).where(and(eq(journeyRuns.browserSessionId, sessionId), eq(journeyRuns.submissionId, submissionId)));
    if (existing) {
      if (existing.templateSlug !== slug || existing.initialQuestion !== trimmed) throw new ConflictError(existing.revision);
      return existing.id;
    }
    if (!journeysEnabled()) throw new ValidationError("journeys_disabled");
    const template = journeyTemplate(slug);
    if (!template) throw new ValidationError("unknown_journey");
    for (const [identifier, limit] of [[`ip:${ip}`, 30], [`session:${sessionId}`, 20]] as const) {
      const budget = await checkAndIncrement(identifier, { action: "reading_create_hour", windowMs: 3600000, limit }, tx);
      if (!budget.allowed) throw new RateLimitedError(budget.retryAfterMs);
    }
    const reading = await insertDraftReading(tx, sessionId, template.focus, trimmed);
    const id = randomId();
    await tx.insert(journeyRuns).values({ id, browserSessionId: sessionId, readingId: reading.id, submissionId, templateSlug: slug, templateVersion: template.version, templateSnapshot: JSON.stringify(template), initialQuestion: trimmed, createdAt: Date.now(), updatedAt: Date.now() });
    return id;
  });
  return getJourney(id, sessionId);
}

const NEXT: Record<JourneyStage, JourneyStage[]> = { frame: ["explore"], explore: ["frame", "reflect"], reflect: ["explore", "complete"], complete: [] };
export async function advanceJourney(id: string, sessionId: string, revision: number, submissionId: string, destination: JourneyStage) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId) || !Number.isInteger(revision) || revision < 0 || !(destination in NEXT)) throw new ValidationError("invalid_request");
  const initial = await owned(db, id, sessionId);
  if (destination !== "frame") await loadGrantedReading(initial.reading.id, sessionId);
  await db.transaction(async (tx) => {
    // Same reading lock as follow-up claims; no transition can race a new turn.
    await tx.select({ id: readings.id }).from(readings).where(eq(readings.id, initial.reading.id)).for("update");
    const { run, reading, grant } = await owned(tx, id, sessionId);
    const [replay] = await tx.select().from(journeyTransitions).where(and(eq(journeyTransitions.journeyId, id), eq(journeyTransitions.submissionId, submissionId)));
    if (replay) {
      if (replay.destination !== destination || replay.expectedRevision !== revision) throw new ConflictError(run.revision);
      return;
    }
    if (run.revision !== revision) throw new ConflictError(run.revision);
    if (!NEXT[run.stage as JourneyStage].includes(destination)) throw new ValidationError("invalid_stage");
    const current = await state(tx, reading, grant);
    if (current.support) throw new ValidationError("conversation_closed");
    if (destination === "reflect" || destination === "complete") {
      if (!current.canReflect) throw new ValidationError("reading_not_ready");
    }
    await tx.update(journeyRuns).set({ stage: destination, revision: revision + 1, updatedAt: Date.now(), ...(destination === "complete" ? { completedAt: Date.now() } : {}) }).where(eq(journeyRuns.id, id));
    await tx.insert(journeyTransitions).values({ id: randomId(), journeyId: id, submissionId, expectedRevision: revision, destination });
  });
  return getJourney(id, sessionId);
}
