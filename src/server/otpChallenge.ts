import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db/client";
import { sessionEmailChallenges, suppressedEmails } from "./db/schema";
import { randomId } from "./ids";
import { generateCode, hashCode, verifyCodeDigest, OTP_TTL_MS, MAX_ATTEMPTS, type OtpPurpose } from "./otp";
import { getEmailProvider } from "./email";
import { checkAndIncrement } from "./rateLimit";
import { hashEmailForLookup } from "./emailHash";
import { RateLimitedError, ValidationError } from "./errors";

export const RESEND_COOLDOWN_MS = 60 * 1000;

export type SendStatus = "accepted" | "pending" | "failed";

export interface ChallengeRow {
  id: string;
  intendedEmail: string;
  codeHmac: string;
  generation: number;
  attempts: number;
  expiresAt: number;
  consumedAt: number | null;
  supersededAt: number | null;
  sendStatus: string;
  createdAt: number;
}

interface NewChallenge {
  id: string;
  subjectId: string;
  intendedEmail: string;
  codeHmac: string;
  keyVersion: number;
  generation: number;
  expiresAt: number;
  createdAt: number;
}

/** Persistence for one kind of challenge; the lifecycle below is table-agnostic. */
export interface ChallengeStore {
  purpose: OtpPurpose;
  list(subjectId: string): Promise<ChallengeRow[]>;
  supersede(id: string, at: number): Promise<void>;
  insert(row: NewChallenge): Promise<void>;
  markDelivery(id: string, sendStatus: SendStatus, providerMessageId: string | undefined): Promise<void>;
  /** Atomic attempts+1 on a still-open challenge; returns the new count. */
  incrementAttempts(id: string): Promise<number | undefined>;
  /** Atomic single-use claim; false if another request consumed it first. */
  consume(id: string, at: number): Promise<boolean>;
}

export const sessionChallenges: ChallengeStore = {
  purpose: "session_continuation",
  list: (sessionId) => db.select().from(sessionEmailChallenges).where(eq(sessionEmailChallenges.browserSessionId, sessionId)),
  supersede: async (id, at) => {
    await db.update(sessionEmailChallenges).set({ supersededAt: at }).where(eq(sessionEmailChallenges.id, id));
  },
  insert: async ({ subjectId, ...row }) => {
    await db.insert(sessionEmailChallenges).values({ ...row, browserSessionId: subjectId, attempts: 0, sendStatus: "pending" });
  },
  markDelivery: async (id, sendStatus, providerMessageId) => {
    await db.update(sessionEmailChallenges).set({ sendStatus, providerMessageId }).where(eq(sessionEmailChallenges.id, id));
  },
  incrementAttempts: async (id) => {
    const [row] = await db
      .update(sessionEmailChallenges)
      .set({ attempts: sql`${sessionEmailChallenges.attempts} + 1` })
      .where(and(eq(sessionEmailChallenges.id, id), isNull(sessionEmailChallenges.consumedAt), isNull(sessionEmailChallenges.supersededAt)))
      .returning({ attempts: sessionEmailChallenges.attempts });
    return row?.attempts;
  },
  consume: async (id, at) => {
    const [row] = await db
      .update(sessionEmailChallenges)
      .set({ consumedAt: at })
      .where(and(eq(sessionEmailChallenges.id, id), isNull(sessionEmailChallenges.consumedAt), isNull(sessionEmailChallenges.supersededAt)))
      .returning({ id: sessionEmailChallenges.id });
    return !!row;
  },
};

export function normalizeEmail(email: string): string {
  // Conservative normalization (PLAN.md section 7): lowercase only, no dot
  // stripping or plus-tag merging.
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const visible = user.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

/** The newest challenge that is neither consumed nor superseded. */
export function openChallenge(rows: ChallengeRow[]): ChallengeRow | undefined {
  return rows.filter((c) => !c.consumedAt && !c.supersededAt).sort((a, b) => b.generation - a.generation)[0];
}

export function pendingChallengeSummary(rows: ChallengeRow[]) {
  const open = openChallenge(rows);
  if (!open) return undefined;
  return {
    expiresAt: open.expiresAt,
    sendStatus: open.sendStatus as SendStatus,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - open.attempts),
    resendAvailableAt: open.createdAt + RESEND_COOLDOWN_MS,
  };
}

function digestFor(store: ChallengeStore, subjectId: string, challengeId: string, generation: number, intendedEmail: string, code: string) {
  const secret = process.env.OTP_HMAC_SECRET ?? "";
  return hashCode(code, { purpose: store.purpose, subjectId, challengeId, generation, intendedEmail }, secret);
}

/**
 * Creates and sends a fresh code for the subject: suppression and cooldown
 * checks first (so a rejected retry costs nothing), then the per-email and
 * per-IP send budgets, then the challenge row and the provider call.
 */
export async function issueCode(store: ChallengeStore, subjectId: string, email: string, ip: string) {
  const normalized = normalizeEmail(email);
  const lookupHash = hashEmailForLookup(normalized);

  const [suppressed] = await db
    .select()
    .from(suppressedEmails)
    .where(eq(suppressedEmails.normalizedLookupHash, lookupHash))
    .limit(1);
  if (suppressed) throw new ValidationError("address_suppressed");

  const prior = await store.list(subjectId);
  const latest = prior.sort((a, b) => b.generation - a.generation)[0];
  const open = openChallenge(prior);
  if (open) {
    const cooldownRemaining = open.createdAt + RESEND_COOLDOWN_MS - Date.now();
    if (cooldownRemaining > 0) throw new RateLimitedError(cooldownRemaining);
  }

  // Configuration errors must not spend the send budget or create a
  // challenge that was never submitted to a provider.
  const provider = getEmailProvider();

  const perEmailHour = await checkAndIncrement(`email:${normalized}`, { action: "otp_send_hour", windowMs: 60 * 60 * 1000, limit: 3 });
  if (!perEmailHour.allowed) throw new RateLimitedError(perEmailHour.retryAfterMs);
  const perEmailDay = await checkAndIncrement(`email:${normalized}`, { action: "otp_send_day", windowMs: 24 * 60 * 60 * 1000, limit: 5 });
  if (!perEmailDay.allowed) throw new RateLimitedError(perEmailDay.retryAfterMs);
  const perIpHour = await checkAndIncrement(`ip:${ip}`, { action: "otp_send_hour", windowMs: 60 * 60 * 1000, limit: 10 });
  if (!perIpHour.allowed) throw new RateLimitedError(perIpHour.retryAfterMs);

  const t = Date.now();
  for (const c of prior) {
    if (!c.consumedAt && !c.supersededAt) await store.supersede(c.id, t);
  }

  const generation = (latest?.generation ?? 0) + 1;
  const challengeId = randomId();
  const code = generateCode();
  await store.insert({
    id: challengeId,
    subjectId,
    intendedEmail: normalized,
    codeHmac: digestFor(store, subjectId, challengeId, generation, normalized, code),
    keyVersion: Number(process.env.OTP_HMAC_KEY_VERSION ?? "1"),
    generation,
    expiresAt: t + OTP_TTL_MS,
    createdAt: t,
  });

  // Awaited within the request (PLAN.md section 6). A network/timeout
  // failure leaves the code "pending" and still usable; only a definite
  // provider rejection is "failed".
  let sendStatus: SendStatus = "pending";
  let providerMessageId: string | undefined;
  let failureReason: string | undefined;
  const startedAt = Date.now();
  const context = { purpose: store.purpose, subjectId, challengeId, provider: provider.name, region: process.env.VERCEL_REGION ?? "local" };
  console.info("[otp_delivery]", { ...context, event: "submission_started" });
  try {
    const result = await provider.sendVerificationCode({ to: normalized, code, subjectId, idempotencyKey: challengeId });
    if (result.status === "accepted") {
      sendStatus = "accepted";
      providerMessageId = result.providerMessageId;
    } else {
      failureReason = result.reason;
      if (result.reason !== "network_error_or_timeout" && result.reason !== "resend_invalid_response") sendStatus = "failed";
    }
  } catch {
    failureReason = "provider_exception";
  }
  // Never log recipients, codes, keys, or raw provider responses.
  console.info("[otp_delivery]", { ...context, event: "submission_finished", sendStatus, providerMessageId, failureReason, durationMs: Date.now() - startedAt });

  await store.markDelivery(challengeId, sendStatus, providerMessageId);

  return {
    challengeId,
    sendStatus,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export type CheckFailure = "no_active_code" | "expired" | "attempts_exhausted" | "wrong_code";

/** Verifies a code against the subject's open challenge and consumes it exactly once. */
export async function checkCode(store: ChallengeStore, subjectId: string, code: string): Promise<{ ok: true; email: string } | { ok: false; reason: CheckFailure }> {
  const current = openChallenge(await store.list(subjectId));
  if (!current) return { ok: false, reason: "no_active_code" };
  if (current.expiresAt < Date.now()) return { ok: false, reason: "expired" };
  if (current.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "attempts_exhausted" };

  const candidate = digestFor(store, subjectId, current.id, current.generation, current.intendedEmail, code);
  if (!verifyCodeDigest(candidate, current.codeHmac)) {
    // The failed-attempt counter is committed before the error is returned
    // (PLAN.md section 6), computed in the database to survive concurrency.
    const attempts = (await store.incrementAttempts(current.id)) ?? current.attempts + 1;
    return { ok: false, reason: MAX_ATTEMPTS - attempts > 0 ? "wrong_code" : "attempts_exhausted" };
  }

  if (!(await store.consume(current.id, Date.now()))) return { ok: false, reason: "no_active_code" };
  return { ok: true, email: current.intendedEmail };
}
