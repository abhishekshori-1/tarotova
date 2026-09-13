import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { readings, emailChallenges, verifiedEmails, suppressedEmails } from "./db/schema";
import { randomId } from "./ids";
import { cryptoShuffle } from "./shuffle";
import { CARDS } from "@/content/cards";
import { DECK_VERSION, SPREAD_VERSION, CONTENT_VERSION } from "@/content/versions";
import { DEFAULT_FOCUS } from "@/content/focuses";
import { POSITIONS, type Focus } from "@/content/types";
import { buildOverview } from "@/content/overview";
import { pickReflection } from "@/content/reflections";
import { generateCode, hashCode, verifyCodeDigest, OTP_TTL_MS, MAX_ATTEMPTS } from "./otp";
import { getEmailProvider } from "./email";
import { checkAndIncrement } from "./rateLimit";
import { hashEmailForLookup } from "./emailHash";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h, PLAN.md section 9
const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, PLAN.md section 6/9
const RESEND_COOLDOWN_MS = 60 * 1000;

export class ConflictError extends Error {
  constructor(public currentRevision: number) {
    super("revision_conflict");
  }
}
export class OwnershipError extends Error {
  constructor() {
    super("not_found");
  }
}
export class ValidationError extends Error {}
export class RateLimitedError extends Error {
  constructor(public retryAfterMs: number) {
    super("rate_limited");
  }
}

function now() {
  return Date.now();
}

function normalizeEmail(email: string): string {
  // Conservative normalization (PLAN.md section 7): lowercase only, no dot
  // stripping or plus-tag merging.
  return email.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const visible = user.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function requireOwnership(sessionId: string, readingBrowserSessionId: string) {
  if (sessionId !== readingBrowserSessionId) throw new OwnershipError();
}

export function createReading(sessionId: string) {
  const mapping = cryptoShuffle(CARDS.map((c) => c.id));
  const id = randomId();
  const t = now();
  db.insert(readings)
    .values({
      id,
      browserSessionId: sessionId,
      state: "drafting",
      revision: 0,
      focus: DEFAULT_FOCUS,
      shuffleMapping: JSON.stringify(mapping),
      selectedSlots: "[]",
      deckVersion: DECK_VERSION,
      spreadVersion: SPREAD_VERSION,
      contentVersion: CONTENT_VERSION,
      draftExpiresAt: t + DRAFT_TTL_MS,
      createdAt: t,
      updatedAt: t,
    })
    .run();
  return safeStatus(getOwnedReading(id, sessionId));
}

function getReadingRow(id: string) {
  return db.select().from(readings).where(eq(readings.id, id)).get();
}

function getOwnedReading(id: string, sessionId: string) {
  const row = getReadingRow(id);
  if (!row) throw new OwnershipError();
  requireOwnership(sessionId, row.browserSessionId);
  return row;
}

export function safeStatus(row: NonNullable<ReturnType<typeof getReadingRow>>) {
  let maskedEmail: string | undefined;
  if (row.verifiedEmailId) {
    const ve = db.select().from(verifiedEmails).where(eq(verifiedEmails.id, row.verifiedEmailId)).get();
    if (ve) maskedEmail = maskEmail(ve.email);
  }
  const latestChallenge = db
    .select()
    .from(emailChallenges)
    .where(eq(emailChallenges.readingId, row.id))
    .all()
    .sort((a, b) => b.generation - a.generation)[0];

  return {
    id: row.id,
    state: row.state,
    revision: row.revision,
    focus: row.focus,
    selectedSlots: JSON.parse(row.selectedSlots) as number[],
    locked: row.lockedSlots !== null,
    maskedEmail,
    pendingChallenge: latestChallenge && !latestChallenge.consumedAt && !latestChallenge.supersededAt
      ? {
          expiresAt: latestChallenge.expiresAt,
          sendStatus: latestChallenge.sendStatus,
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - latestChallenge.attempts),
          resendAvailableAt: latestChallenge.createdAt + RESEND_COOLDOWN_MS,
        }
      : undefined,
    resultAvailable: row.state === "verified" && (row.accessExpiresAt ?? 0) > now(),
  };
}

export function getStatus(readingId: string, sessionId: string) {
  return safeStatus(getOwnedReading(readingId, sessionId));
}

export function reshuffle(readingId: string, sessionId: string, expectedRevision: number) {
  const row = getOwnedReading(readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);
  if (row.state !== "drafting") throw new ValidationError("already_locked");
  const selected = JSON.parse(row.selectedSlots) as number[];
  if (selected.length > 0) throw new ValidationError("selection_not_empty");

  const mapping = cryptoShuffle(CARDS.map((c) => c.id));
  db.update(readings)
    .set({ shuffleMapping: JSON.stringify(mapping), revision: row.revision + 1, updatedAt: now() })
    .where(eq(readings.id, readingId))
    .run();
  return safeStatus(getOwnedReading(readingId, sessionId));
}

export function updateSelection(
  readingId: string,
  sessionId: string,
  expectedRevision: number,
  slots: number[],
  lock: boolean,
  focus: Focus | undefined,
) {
  const row = getOwnedReading(readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);

  // Locking is idempotent: an identical retry against an already-locked
  // reading with the same slots/focus is a safe no-op (PLAN.md section 3).
  if (row.state === "locked" || row.state === "verified") {
    const already = JSON.parse(row.lockedSlots ?? "[]") as number[];
    const sameSlots = lock && already.length === 3 && already.every((s, i) => s === slots[i]);
    if (sameSlots) return safeStatus(row);
    throw new ValidationError("already_locked");
  }

  if (lock && slots.length !== 3) throw new ValidationError("lock_requires_three_slots");

  const mapping = JSON.parse(row.shuffleMapping) as string[];
  const patch: Partial<typeof readings.$inferInsert> = {
    selectedSlots: JSON.stringify(slots),
    revision: row.revision + 1,
    updatedAt: now(),
  };
  if (focus) patch.focus = focus;

  if (lock) {
    const resolvedCardIds = slots.map((s) => mapping[s]);
    const cards = POSITIONS.map((pos, i) => {
      const card = CARDS.find((c) => c.id === resolvedCardIds[i]);
      if (!card) throw new ValidationError("invalid_slot");
      return { position: pos, card };
    });
    const [situation, challenge, guidance] = cards.map((c) => c.card);
    const effectiveFocus = (focus ?? row.focus) as Focus;
    const snapshot = {
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
    };
    patch.lockedSlots = JSON.stringify(slots);
    patch.resolvedCardIds = JSON.stringify(resolvedCardIds);
    patch.resultSnapshot = JSON.stringify(snapshot);
    patch.state = "locked";
  }

  db.update(readings).set(patch).where(eq(readings.id, readingId)).run();
  return safeStatus(getOwnedReading(readingId, sessionId));
}

export async function requestOtp(
  readingId: string,
  sessionId: string,
  expectedRevision: number,
  email: string,
  ip: string,
) {
  const row = getOwnedReading(readingId, sessionId);
  if (row.revision !== expectedRevision) throw new ConflictError(row.revision);
  if (row.state !== "locked") throw new ValidationError("reading_not_locked");

  const normalized = normalizeEmail(email);
  const lookupHash = hashEmailForLookup(normalized);

  const suppressed = db
    .select()
    .from(suppressedEmails)
    .where(eq(suppressedEmails.normalizedLookupHash, lookupHash))
    .get();
  if (suppressed) throw new ValidationError("address_suppressed");

  const perEmailHour = checkAndIncrement(`email:${normalized}`, { action: "otp_send_hour", windowMs: 60 * 60 * 1000, limit: 3 });
  if (!perEmailHour.allowed) throw new RateLimitedError(perEmailHour.retryAfterMs);
  const perEmailDay = checkAndIncrement(`email:${normalized}`, { action: "otp_send_day", windowMs: 24 * 60 * 60 * 1000, limit: 5 });
  if (!perEmailDay.allowed) throw new RateLimitedError(perEmailDay.retryAfterMs);
  const perIpHour = checkAndIncrement(`ip:${ip}`, { action: "otp_send_hour", windowMs: 60 * 60 * 1000, limit: 10 });
  if (!perIpHour.allowed) throw new RateLimitedError(perIpHour.retryAfterMs);

  const priorChallenges = db.select().from(emailChallenges).where(eq(emailChallenges.readingId, readingId)).all();
  const latest = priorChallenges.sort((a, b) => b.generation - a.generation)[0];
  if (latest && !latest.consumedAt && !latest.supersededAt) {
    const cooldownRemaining = latest.createdAt + RESEND_COOLDOWN_MS - now();
    if (cooldownRemaining > 0) throw new RateLimitedError(cooldownRemaining);
  }

  // A resend/email-change supersedes the previous challenge without
  // resetting the rolling abuse budgets above (PLAN.md section 6).
  for (const c of priorChallenges) {
    if (!c.consumedAt && !c.supersededAt) {
      db.update(emailChallenges).set({ supersededAt: now() }).where(eq(emailChallenges.id, c.id)).run();
    }
  }

  const generation = (latest?.generation ?? 0) + 1;
  const challengeId = randomId();
  const code = generateCode();
  const t = now();
  const keyVersion = Number(process.env.OTP_HMAC_KEY_VERSION ?? "1");
  const secret = process.env.OTP_HMAC_SECRET ?? "";
  const digest = hashCode(code, { readingId, challengeId, generation, intendedEmail: normalized }, secret);

  db.insert(emailChallenges)
    .values({
      id: challengeId,
      readingId,
      intendedEmail: normalized,
      codeHmac: digest,
      keyVersion,
      generation,
      attempts: 0,
      expiresAt: t + OTP_TTL_MS,
      sendStatus: "pending",
      createdAt: t,
    })
    .run();

  const provider = getEmailProvider();
  const idempotencyKey = challengeId;

  // Awaited within the request per PLAN.md section 6: "await delivery
  // submission within the request; do not rely on unfinished work after a
  // serverless response." A network/timeout failure leaves sendStatus
  // "pending" (a still-usable code), not "failed" — only a definite
  // provider rejection is marked failed.
  let sendStatus: "accepted" | "pending" | "failed" = "pending";
  let providerMessageId: string | undefined;
  try {
    const result = await provider.sendVerificationCode({ to: normalized, code, readingId, idempotencyKey });
    if (result.status === "accepted") {
      sendStatus = "accepted";
      providerMessageId = result.providerMessageId;
    } else if (result.reason !== "network_error_or_timeout") {
      sendStatus = "failed";
    }
  } catch {
    // Acceptance is uncertain, not a definite failure — keep "pending".
  }

  db.update(emailChallenges).set({ sendStatus, providerMessageId }).where(eq(emailChallenges.id, challengeId)).run();

  return {
    readingId,
    challengeId,
    sendStatus,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export function verifyOtp(readingId: string, sessionId: string, code: string) {
  const row = getOwnedReading(readingId, sessionId);

  // Idempotent success: a lost response shouldn't grant extra access, but a
  // repeat verify from the same session should still succeed quietly
  // (PLAN.md section 6).
  if (row.state === "verified") {
    if ((row.accessExpiresAt ?? 0) > now()) return { ok: true as const };
    throw new ValidationError("access_expired");
  }

  if (row.state !== "locked") throw new ValidationError("no_pending_challenge");

  const challenges = db.select().from(emailChallenges).where(eq(emailChallenges.readingId, readingId)).all();
  const current = challenges
    .filter((c) => !c.consumedAt && !c.supersededAt)
    .sort((a, b) => b.generation - a.generation)[0];

  if (!current) return { ok: false as const, reason: "no_active_code" as const };
  if (current.expiresAt < now()) return { ok: false as const, reason: "expired" as const };
  if (current.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "attempts_exhausted" as const };

  const secret = process.env.OTP_HMAC_SECRET ?? "";
  const candidateDigest = hashCode(
    code,
    { readingId, challengeId: current.id, generation: current.generation, intendedEmail: current.intendedEmail },
    secret,
  );
  const match = verifyCodeDigest(candidateDigest, current.codeHmac);

  if (!match) {
    // Commit the failed-attempt counter before returning an error (PLAN.md
    // section 6) — this write happens unconditionally, not inside a
    // try/catch that could roll it back.
    db.update(emailChallenges).set({ attempts: current.attempts + 1 }).where(eq(emailChallenges.id, current.id)).run();
    const remaining = MAX_ATTEMPTS - (current.attempts + 1);
    return { ok: false as const, reason: remaining > 0 ? ("wrong_code" as const) : ("attempts_exhausted" as const) };
  }

  const t = now();
  db.update(emailChallenges).set({ consumedAt: t }).where(eq(emailChallenges.id, current.id)).run();

  const normalized = current.intendedEmail;
  const lookupHash = hashEmailForLookup(normalized);
  let ve = db.select().from(verifiedEmails).where(eq(verifiedEmails.normalizedLookup, lookupHash)).get();
  if (ve) {
    db.update(verifiedEmails).set({ lastActivityAt: t }).where(eq(verifiedEmails.id, ve.id)).run();
  } else {
    const veId = randomId();
    db.insert(verifiedEmails)
      .values({ id: veId, email: normalized, normalizedLookup: lookupHash, verifiedAt: t, lastActivityAt: t })
      .run();
    ve = { id: veId, email: normalized, normalizedLookup: lookupHash, verifiedAt: t, lastActivityAt: t };
  }

  db.update(readings)
    .set({
      state: "verified",
      verifiedEmailId: ve.id,
      verifiedAt: t,
      accessExpiresAt: t + ACCESS_TTL_MS,
      revision: row.revision + 1,
      updatedAt: t,
    })
    .where(eq(readings.id, readingId))
    .run();

  return { ok: true as const };
}

export function getResult(readingId: string, sessionId: string) {
  const row = getOwnedReading(readingId, sessionId);
  if (row.state !== "verified") throw new OwnershipError();
  if ((row.accessExpiresAt ?? 0) <= now()) throw new OwnershipError();
  return JSON.parse(row.resultSnapshot ?? "null");
}
