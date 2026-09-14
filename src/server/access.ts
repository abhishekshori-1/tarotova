import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "./db/client";
import { browserSessions, readingAccessGrants, verifiedEmails } from "./db/schema";
import { randomId } from "./ids";

export const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, PLAN.md section 6/9
export const VERIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // docs/ACCESS-FLOW.md section 1

/** Any query runner with the same builder surface — the shared client or an open transaction. */
export type Executor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type SessionRow = typeof browserSessions.$inferSelect;
export type GrantRow = typeof readingAccessGrants.$inferSelect;
export type GrantBasis = "guest" | "verified_session";

/**
 * granted: this session holds an unexpired grant → the result is readable.
 * eligible: no grant yet, but locking (or reading the result) will produce
 *   one — the session is verified, or its free reading is still unclaimed
 *   (or was claimed by this very reading).
 * verification_required: the free reading is spent on another reading and
 *   the session is not verified.
 */
export type Entitlement = "granted" | "eligible" | "verification_required";

export async function getSessionRow(ex: Executor, sessionId: string): Promise<SessionRow> {
  const [row] = await ex.select().from(browserSessions).where(eq(browserSessions.id, sessionId)).limit(1);
  if (!row) throw new Error(`browser session ${sessionId} missing`);
  return row;
}

export function sessionIsVerified(session: SessionRow, now: number): boolean {
  return (session.verifiedUntil ?? 0) > now;
}

export async function getGrant(ex: Executor, readingId: string): Promise<GrantRow | undefined> {
  const [row] = await ex.select().from(readingAccessGrants).where(eq(readingAccessGrants.readingId, readingId)).limit(1);
  return row;
}

export function isActive(grant: GrantRow | undefined, now: number): grant is GrantRow {
  return !!grant && grant.expiresAt > now;
}

export function entitlementFor(readingId: string, session: SessionRow, grant: GrantRow | undefined, now: number): Entitlement {
  if (isActive(grant, now)) return "granted";
  if (sessionIsVerified(session, now)) return "eligible";
  if (session.guestReadingId === null || session.guestReadingId === readingId) return "eligible";
  return "verification_required";
}

/**
 * Issues the reading's grant if this session is entitled to one. Call inside
 * the transaction that locks the draw so the guest claim and the grant
 * commit together. Idempotent: an existing grant is returned as-is.
 */
export async function issueGrant(ex: Executor, readingId: string, sessionId: string, now: number): Promise<GrantRow | undefined> {
  const existing = await getGrant(ex, readingId);
  if (existing) return existing;

  const session = await getSessionRow(ex, sessionId);
  let basis: GrantBasis;
  if (sessionIsVerified(session, now)) {
    basis = "verified_session";
  } else {
    // The single guest slot is claimed with a conditional update, never a
    // read-then-write, so two concurrent locks cannot both take it.
    const [claimed] = await ex
      .update(browserSessions)
      .set({ guestReadingId: readingId })
      .where(and(eq(browserSessions.id, sessionId), or(isNull(browserSessions.guestReadingId), eq(browserSessions.guestReadingId, readingId))))
      .returning({ id: browserSessions.id });
    if (!claimed) return undefined;
    basis = "guest";
  }

  const [grant] = await ex
    .insert(readingAccessGrants)
    .values({ id: randomId(), readingId, browserSessionId: sessionId, basis, createdAt: now, expiresAt: now + ACCESS_TTL_MS })
    .onConflictDoNothing({ target: readingAccessGrants.readingId })
    .returning();
  return grant ?? (await getGrant(ex, readingId));
}

/** Records a verified email on the session for a fixed window from now; activity never extends it. */
export async function markSessionVerified(ex: Executor, sessionId: string, email: string, lookupHash: string, now: number) {
  const [ve] = await ex
    .insert(verifiedEmails)
    .values({ id: randomId(), email, normalizedLookup: lookupHash, verifiedAt: now, lastActivityAt: now })
    .onConflictDoUpdate({ target: verifiedEmails.normalizedLookup, set: { lastActivityAt: now } })
    .returning();
  await ex.update(browserSessions).set({ verifiedEmailId: ve.id, verifiedUntil: now + VERIFICATION_TTL_MS }).where(eq(browserSessions.id, sessionId));
  return ve;
}
