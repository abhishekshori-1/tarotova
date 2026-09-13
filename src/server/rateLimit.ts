import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
 * Fixed-window counter backed by a unique (identifier, action, window) row.
 * better-sqlite3 is synchronous and single-connection, so this increment is
 * inherently serialized in local dev; a Postgres deployment would wrap the
 * same upsert-and-check in an explicit transaction (PLAN.md section 6).
 */
export function checkAndIncrement(identifier: string, policy: RateLimitPolicy): RateLimitResult {
  const digest = identifierDigest(identifier);
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const expiresAt = windowStart + policy.windowMs;

  const existing = db
    .select()
    .from(rateLimitBuckets)
    .where(
      and(
        eq(rateLimitBuckets.identifierDigest, digest),
        eq(rateLimitBuckets.action, policy.action),
        eq(rateLimitBuckets.windowStart, windowStart),
      ),
    )
    .get();

  const count = (existing?.count ?? 0) + 1;

  if (existing) {
    db.update(rateLimitBuckets).set({ count }).where(eq(rateLimitBuckets.id, existing.id)).run();
  } else {
    db.insert(rateLimitBuckets)
      .values({ id: randomId(), identifierDigest: digest, action: policy.action, windowStart, count, expiresAt })
      .run();
  }

  return {
    allowed: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterMs: Math.max(0, expiresAt - now),
  };
}
