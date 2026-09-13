import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { rateLimitBuckets } from "./db/schema";
import { randomId } from "./ids";

/** Keyed digest so raw IPs/emails never sit in the rate-limit table (PLAN.md section 6). */
export function identifierDigest(raw: string): string {
  const secret = process.env.SESSION_HASH_SECRET ?? "";
  return createHash("sha256").update(secret).update(raw.toLowerCase()).digest("hex");
}

export interface RateLimitPolicy {
  action: string;
  windowMs: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Fixed-window counter backed by a unique (identifier, action, window) row,
 * incremented with a single atomic `INSERT ... ON CONFLICT DO UPDATE`
 * (Postgres) — genuinely race-free under concurrent requests across
 * serverless instances, unlike the previous read-then-write version this
 * replaced (PLAN.md section 6 calls for exactly this kind of atomic
 * counter).
 */
export async function checkAndIncrement(identifier: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const digest = identifierDigest(identifier);
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const expiresAt = windowStart + policy.windowMs;

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ id: randomId(), identifierDigest: digest, action: policy.action, windowStart, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.identifierDigest, rateLimitBuckets.action, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  const count = row.count;
  return {
    allowed: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterMs: Math.max(0, expiresAt - now),
  };
}
