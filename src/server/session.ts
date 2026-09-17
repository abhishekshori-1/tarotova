import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { browserSessions } from "./db/schema";
import { randomId } from "./ids";

const COOKIE_NAME = "tarotova_sid";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, PLAN.md section 6/9
const RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  const secret = process.env.SESSION_HASH_SECRET ?? "";
  return createHash("sha256").update(secret).update(token).digest("hex");
}

/**
 * The session slides on activity so a returning visitor keeps their
 * readings, but the write is throttled to once a day so ordinary browsing
 * doesn't touch the row on every request.
 */
export function sessionNeedsRenewal(expiresAt: number, now: number): boolean {
  return expiresAt - now < SESSION_TTL_MS - RENEW_INTERVAL_MS;
}

export interface Session {
  id: string;
  isNew: boolean;
}

/**
 * Resolves the caller's browser session from the `tarotova_sid` cookie,
 * creating one if absent or expired. Only the token's hash is stored
 * (PLAN.md section 6) — the raw token lives only in the Secure, HttpOnly
 * cookie on the visitor's device.
 *
 * Must be called from a Route Handler / Server Action (cookie mutation
 * requires a request-scoped response context).
 */
export async function resolveSession(): Promise<Session> {
  const store = await cookies();
  const existingToken = store.get(COOKIE_NAME)?.value;
  const now = Date.now();

  if (existingToken) {
    const hash = hashToken(existingToken);
    const [row] = await db.select().from(browserSessions).where(eq(browserSessions.tokenHash, hash)).limit(1);
    if (row && row.expiresAt > now) {
      if (sessionNeedsRenewal(row.expiresAt, now)) {
        await db.update(browserSessions).set({ expiresAt: now + SESSION_TTL_MS }).where(eq(browserSessions.id, row.id));
        setCookie(store, existingToken);
      }
      return { id: row.id, isNew: false };
    }
  }

  const token = randomBytes(32).toString("base64url");
  const id = randomId();
  await db.insert(browserSessions).values({ id, tokenHash: hashToken(token), createdAt: now, expiresAt: now + SESSION_TTL_MS });
  setCookie(store, token);

  return { id, isNew: true };
}

function setCookie(store: Awaited<ReturnType<typeof cookies>>, token: string) {
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** A resume shortcut must not mint a competing session while the visitor starts a reading. */
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await db.select().from(browserSessions).where(eq(browserSessions.tokenHash, hashToken(token))).limit(1);
  return row && row.expiresAt > Date.now() ? { id: row.id, isNew: false } : null;
}

/** Presence only: skip migrations and queries on public visits with no existing session. */
export async function hasSessionCookie(): Promise<boolean> {
  return !!(await cookies()).get(COOKIE_NAME)?.value;
}
