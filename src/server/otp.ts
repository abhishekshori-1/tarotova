import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_DIGITS = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes, PLAN.md section 6
export const MAX_ATTEMPTS = 5;

/** Six-digit code, cryptographically random, leading zeros preserved as a string. */
export function generateCode(): string {
  return randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

/** What a code unlocks; part of the digest so a future purpose can never reuse a code. */
export type OtpPurpose = "session_continuation";

export interface OtpContext {
  purpose: OtpPurpose;
  /** The browser session id the challenge belongs to. */
  subjectId: string;
  challengeId: string;
  generation: number;
  intendedEmail: string;
}

function contextString(ctx: OtpContext): string {
  return [ctx.purpose, ctx.subjectId, ctx.challengeId, String(ctx.generation), ctx.intendedEmail.toLowerCase()].join("|");
}

/** Keyed HMAC of the code bound to its full challenge context; never store the raw code. */
export function hashCode(code: string, ctx: OtpContext, secret: string): string {
  return createHmac("sha256", secret).update(contextString(ctx)).update(":").update(code).digest("hex");
}

/** Constant-time comparison of two hex digests of the same declared length. */
export function verifyCodeDigest(candidateDigest: string, storedDigest: string): boolean {
  const a = Buffer.from(candidateDigest, "hex");
  const b = Buffer.from(storedDigest, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
