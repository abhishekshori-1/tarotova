import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { browserSessions } from "./db/schema";
import { randomId } from "./ids";

const COOKIE_NAME = "tarotova_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, PLAN.md section 6/9

function hashToken(token: string): string {
  const secret = process.env.SESSION_HASH_SECRET ?? "";
  return createHash("sha256").update(secret).update(token).digest("hex");
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

  if (existingToken) {
    const hash = hashToken(existingToken);
    const row = db.select().from(browserSessions).where(eq(browserSessions.tokenHash, hash)).get();
    if (row && row.expiresAt > Date.now()) {
      return { id: row.id, isNew: false };
    }
  }

  const token = randomBytes(32).toString("base64url");
  const id = randomId();
  const now = Date.now();
  db.insert(browserSessions)
    .values({ id, tokenHash: hashToken(token), createdAt: now, expiresAt: now + SESSION_TTL_MS })
    .run();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return { id, isNew: true };
}
