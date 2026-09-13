import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { verifiedEmails } from "./db/schema";
import { getSessionRow, markSessionVerified, sessionIsVerified } from "./access";
import { checkCode, issueCode, maskEmail, pendingChallengeSummary, sessionChallenges } from "./otpChallenge";
import { hashEmailForLookup } from "./emailHash";

/** Session-level verification (docs/ACCESS-FLOW.md section 6): unlocks further draws in this browser. */
export async function getSessionVerification(sessionId: string) {
  const now = Date.now();
  const session = await getSessionRow(db, sessionId);
  const verified = sessionIsVerified(session, now);
  let maskedEmail: string | undefined;
  if (session.verifiedEmailId) {
    const [ve] = await db.select().from(verifiedEmails).where(eq(verifiedEmails.id, session.verifiedEmailId)).limit(1);
    if (ve) maskedEmail = maskEmail(ve.email);
  }
  const rows = await sessionChallenges.list(sessionId);
  const pending = pendingChallengeSummary(rows);
  return {
    verified,
    verifiedUntil: verified ? session.verifiedUntil : undefined,
    guestReadingUsed: session.guestReadingId !== null,
    maskedEmail: verified ? maskedEmail : pending ? maskEmail(rows.find((r) => !r.consumedAt && !r.supersededAt)!.intendedEmail) : undefined,
    pendingChallenge: pending,
  };
}

export async function requestSessionCode(sessionId: string, email: string, ip: string) {
  await getSessionRow(db, sessionId);
  const result = await issueCode(sessionChallenges, sessionId, email, ip);
  return { sessionId, ...result };
}

export async function confirmSessionCode(sessionId: string, code: string) {
  const now = Date.now();
  const result = await checkCode(sessionChallenges, sessionId, code);
  if (!result.ok) {
    // A lost response shouldn't force a second code: once the session is
    // verified and no challenge is open, a repeat confirm succeeds quietly.
    if (result.reason === "no_active_code" && sessionIsVerified(await getSessionRow(db, sessionId), now)) return { ok: true as const };
    return result;
  }
  await markSessionVerified(db, sessionId, result.email, hashEmailForLookup(result.email), now);
  return { ok: true as const };
}
