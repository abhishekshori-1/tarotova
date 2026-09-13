import { createHash } from "node:crypto";

/**
 * Keyed digest of a normalized email, used as the indexed lookup key for
 * both `verified_emails.normalized_lookup` and `suppressed_emails.normalized_lookup_hash`
 * (PLAN.md section 7) — the raw address is never used as a lookup key.
 * Shared by readingService.ts and the email webhook route so both stay in
 * sync on the same normalization + hash.
 */
export function hashEmailForLookup(normalizedEmail: string): string {
  const secret = process.env.SESSION_HASH_SECRET ?? "";
  return createHash("sha256").update(secret).update(normalizedEmail).digest("hex");
}
