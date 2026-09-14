import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { readings } from "./db/schema";
import { randomId } from "./ids";
import { cryptoShuffle } from "./shuffle";
import { CARDS } from "@/content/cards";
import { DECK_VERSION, SPREAD_VERSION, CONTENT_VERSION } from "@/content/versions";
import { DEFAULT_FOCUS } from "@/content/focuses";
import { POSITIONS, type Focus } from "@/content/types";
import { buildOverview } from "@/content/overview";
import { pickReflection } from "@/content/reflections";
import { entitlementFor, getGrant, getSessionRow, isActive, issueGrant, sessionIsVerified, type Entitlement, type Executor } from "./access";
import { AccessRequiredError, ConflictError, OwnershipError, ValidationError } from "./errors";
import { getGeneration, viewOf } from "./generation/store";

export { AccessRequiredError, ConflictError, OwnershipError, RateLimitedError, ValidationError } from "./errors";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h, PLAN.md section 9
export const QUESTION_MAX_LENGTH = 500;

function now() {
  return Date.now();
}

function requireOwnership(sessionId: string, readingBrowserSessionId: string) {
  if (sessionId !== readingBrowserSessionId) throw new OwnershipError();
}

function cleanQuestion(question: string | null | undefined): string | null {
  const trimmed = question?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > QUESTION_MAX_LENGTH) throw new ValidationError("question_too_long");
  return trimmed;
}

export async function createReading(sessionId: string, focus: Focus = DEFAULT_FOCUS, question?: string | null) {
  const mapping = cryptoShuffle(CARDS.map((c) => c.id));
  const id = randomId();
  const t = now();
  const [row] = await db.insert(readings).values({
    id,
    browserSessionId: sessionId,
    state: "drafting",
    revision: 0,
    focus,
    question: cleanQuestion(question),
    shuffleMapping: JSON.stringify(mapping),
    selectedSlots: "[]",
    deckVersion: DECK_VERSION,
    spreadVersion: SPREAD_VERSION,
    contentVersion: CONTENT_VERSION,
    draftExpiresAt: t + DRAFT_TTL_MS,
    createdAt: t,
    updatedAt: t,
  }).returning();
  return safeStatus(row, sessionId);
}

type ReadingRow = typeof readings.$inferSelect;

export interface ResultSnapshot {
  focus: Focus;
  overview: string;
  reflection: string;
  cards: { position: (typeof POSITIONS)[number]; id: string; name: string; numeral: string; keywords: string[]; interpretation: string; focusNote: string }[];
  deckVersion: string;
  spreadVersion: string;
  contentVersion: string;
}

async function getReadingRow(ex: Executor, id: string) {
  const [row] = await ex.select().from(readings).where(eq(readings.id, id)).limit(1);
  return row;
}

async function getOwnedReading(ex: Executor, id: string, sessionId: string): Promise<ReadingRow> {
  const row = await getReadingRow(ex, id);
  if (!row) throw new OwnershipError();
  requireOwnership(sessionId, row.browserSessionId);
  // An abandoned draft (or a locked draw nobody ever gained access to) is
  // gone after the draft TTL, whether or not the deletion job has run yet.
  if (row.draftExpiresAt <= now()) {
    if (row.state === "drafting") throw new OwnershipError();
    if (!isActive(await getGrant(ex, row.id), now())) throw new OwnershipError();
  }
  return row;
}

/**
 * Applies a draft mutation only if the row is still at the revision the
 * caller saw and still drafting. The WHERE clause is the concurrency
 * control: two tabs that both read revision N cannot both write N+1.
 */
async function updateDraftAtRevision(ex: Executor, readingId: string, sessionId: string, expectedRevision: number, patch: Partial<typeof readings.$inferInsert>) {
  const [updated] = await ex
    .update(readings)
    .set(patch)
    .where(and(eq(readings.id, readingId), eq(readings.revision, expectedRevision), eq(readings.state, "drafting")))
    .returning();
  if (updated) return updated;
  const current = await getOwnedReading(ex, readingId, sessionId);
  if (current.revision !== expectedRevision) throw new ConflictError(current.revision);
  throw new ValidationError("already_locked");
}

export async function safeStatus(row: ReadingRow, sessionId: string) {
  const t = now();
  const [session, grant] = await Promise.all([getSessionRow(db, sessionId), getGrant(db, row.id)]);
  const entitlement: Entitlement = row.state === "drafting" && sessionIsVerified(session, t)
    ? "eligible"
    : entitlementFor(row.id, session, grant, t);

  return {
    id: row.id,
    state: row.state,
    revision: row.revision,
    focus: row.focus,
    question: row.question,
    selectedSlots: JSON.parse(row.selectedSlots) as number[],
    locked: row.lockedSlots !== null,
    entitlement,
    accessExpiresAt: isActive(grant, t) ? grant.expiresAt : undefined,
    sessionVerified: sessionIsVerified(session, t),
    resultAvailable: entitlement === "granted",
  };
}

export type ReadingStatus = Awaited<ReturnType<typeof safeStatus>>;

export async function getStatus(readingId: string, sessionId: string) {
  return safeStatus(await getOwnedReading(db, readingId, sessionId), sessionId);
}

export async function updateContext(readingId: string, sessionId: string, expectedRevision: number, question: string | null) {
  const row = await getOwnedReading(db, readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);
  if (row.state !== "drafting") throw new ValidationError("already_locked");
  const updated = await updateDraftAtRevision(db, readingId, sessionId, expectedRevision, {
    question: cleanQuestion(question),
    revision: row.revision + 1,
    updatedAt: now(),
  });
  return safeStatus(updated, sessionId);
}

export async function reshuffle(readingId: string, sessionId: string, expectedRevision: number) {
  const row = await getOwnedReading(db, readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);
  if (row.state !== "drafting") throw new ValidationError("already_locked");
  const selected = JSON.parse(row.selectedSlots) as number[];
  if (selected.length > 0) throw new ValidationError("selection_not_empty");

  const mapping = cryptoShuffle(CARDS.map((c) => c.id));
  const updated = await updateDraftAtRevision(db, readingId, sessionId, expectedRevision, {
    shuffleMapping: JSON.stringify(mapping),
    revision: row.revision + 1,
    updatedAt: now(),
  });
  return safeStatus(updated, sessionId);
}

export async function updateSelection(
  readingId: string,
  sessionId: string,
  expectedRevision: number,
  slots: number[],
  lock: boolean,
  focus: Focus | undefined,
) {
  const row = await getOwnedReading(db, readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);

  // Locking is idempotent: an identical retry against an already-locked
  // reading with the same slots is a safe no-op (PLAN.md section 3).
  if (row.state !== "drafting") {
    const already = JSON.parse(row.lockedSlots ?? "[]") as number[];
    const sameSlots = lock && already.length === 3 && already.every((s, i) => s === slots[i]);
    if (sameSlots) return safeStatus(row, sessionId);
    throw new ValidationError("already_locked");
  }

  if (lock && slots.length !== 3) throw new ValidationError("lock_requires_three_slots");

  const mapping = JSON.parse(row.shuffleMapping) as string[];
  const t = now();
  const patch: Partial<typeof readings.$inferInsert> = {
    selectedSlots: JSON.stringify(slots),
    revision: row.revision + 1,
    updatedAt: t,
  };
  if (focus) patch.focus = focus;

  if (!lock) return safeStatus(await updateDraftAtRevision(db, readingId, sessionId, expectedRevision, patch), sessionId);

  const resolvedCardIds = slots.map((s) => mapping[s]);
  const cards = POSITIONS.map((pos, i) => {
    const card = CARDS.find((c) => c.id === resolvedCardIds[i]);
    if (!card) throw new ValidationError("invalid_slot");
    return { position: pos, card };
  });
  const [situation, challenge, guidance] = cards.map((c) => c.card);
  const effectiveFocus = (focus ?? row.focus) as Focus;
  patch.lockedSlots = JSON.stringify(slots);
  patch.resolvedCardIds = JSON.stringify(resolvedCardIds);
  patch.resultSnapshot = JSON.stringify({
    focus: effectiveFocus,
    overview: buildOverview(situation, challenge, guidance, effectiveFocus),
    reflection: pickReflection(effectiveFocus, readingId),
    cards: cards.map(({ position, card }) => ({
      position,
      id: card.id,
      name: card.name,
      numeral: card.numeral,
      keywords: card.keywords,
      interpretation: card.position[position],
      focusNote: card.focus[effectiveFocus],
    })),
    deckVersion: row.deckVersion,
    spreadVersion: row.spreadVersion,
    contentVersion: row.contentVersion,
  } satisfies ResultSnapshot);
  patch.state = "locked";

  // The draw freezes and the access grant (guest claim included) commit
  // together; a lost race leaves the reading locked with no grant, and the
  // caller sees entitlement "verification_required".
  const locked = await db.transaction(async (tx) => {
    const updated = await updateDraftAtRevision(tx, readingId, sessionId, expectedRevision, patch);
    await issueGrant(tx, readingId, sessionId, t);
    return updated;
  });
  return safeStatus(locked, sessionId);
}

/**
 * The locked reading plus the grant that authorizes reading it. Shared by
 * the result endpoint and the contextual-answer service so both enforce
 * exactly the same entitlement (docs/ACCESS-FLOW.md section 7).
 */
export async function loadGrantedReading(readingId: string, sessionId: string) {
  const row = await getOwnedReading(db, readingId, sessionId);
  if (row.state === "drafting" || !row.resultSnapshot) throw new OwnershipError();
  const t = now();

  let grant = await getGrant(db, readingId);
  if (!isActive(grant, t)) {
    if (grant) throw new OwnershipError(); // expired access is simply gone
    // No grant yet (the losing tab of a race) — a session that has since
    // become entitled claims it here, idempotently.
    grant = await db.transaction((tx) => issueGrant(tx, readingId, sessionId, t));
    if (!grant) throw new AccessRequiredError();
  }

  return { row, grant, snapshot: JSON.parse(row.resultSnapshot) as ResultSnapshot };
}

export async function getResult(readingId: string, sessionId: string) {
  const { row, grant, snapshot } = await loadGrantedReading(readingId, sessionId);
  const interpretation = viewOf(await getGeneration(db, readingId), grant.basis, row.question, now());
  return { question: row.question, ...snapshot, interpretation };
}
