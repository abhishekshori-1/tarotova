import { pgTable, text, integer, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

// Real Postgres schema (Supabase in production; pglite locally/in tests —
// see db/client.ts) matching the field lists in docs/PLAN.md section 7.
// Timestamp columns store epoch milliseconds (matching `Date.now()`
// throughout the app) as `bigint` in "number" mode — plain `integer` (32-bit)
// overflows well before today's date, so this isn't optional.

const epochMs = (name: string) => bigint(name, { mode: "number" });

export const browserSessions = pgTable("browser_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: epochMs("created_at").notNull(),
  expiresAt: epochMs("expires_at").notNull(),
  // The one email-free reading this browser gets; claimed atomically at lock.
  guestReadingId: text("guest_reading_id"),
  // Session-level verification (docs/ACCESS-FLOW.md section 5). Fixed
  // window from the moment of verification; activity never extends it.
  verifiedEmailId: text("verified_email_id"),
  verifiedUntil: epochMs("verified_until"),
});

export const readings = pgTable(
  "readings",
  {
    id: text("id").primaryKey(), // opaque public id
    browserSessionId: text("browser_session_id")
      .notNull()
      .references(() => browserSessions.id),
    state: text("state").notNull().default("drafting"), // drafting | locked
    revision: integer("revision").notNull().default(0),
    focus: text("focus").notNull().default("general"),
    question: text("question"), // optional intention, editable while drafting, frozen at lock
    shuffleMapping: text("shuffle_mapping").notNull(), // JSON: slot index -> card id (private)
    selectedSlots: text("selected_slots").notNull().default("[]"), // JSON int[], editable, order matters
    lockedSlots: text("locked_slots"), // JSON int[3], set once, order = Situation/Challenge/Guidance
    resolvedCardIds: text("resolved_card_ids"), // JSON string[3], set at lock
    deckVersion: text("deck_version").notNull(),
    spreadVersion: text("spread_version").notNull(),
    contentVersion: text("content_version").notNull(),
    resultSnapshot: text("result_snapshot"), // JSON, frozen at lock time
    draftExpiresAt: epochMs("draft_expires_at").notNull(),
    accessExpiresAt: epochMs("access_expires_at"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [index("readings_session_idx").on(t.browserSessionId), index("readings_expiry_idx").on(t.draftExpiresAt, t.accessExpiresAt)],
);

export const verifiedEmails = pgTable(
  "verified_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    normalizedLookup: text("normalized_lookup").notNull(),
    verifiedAt: epochMs("verified_at").notNull(),
    lastActivityAt: epochMs("last_activity_at").notNull(),
  },
  (t) => [uniqueIndex("verified_emails_lookup_idx").on(t.normalizedLookup)],
);

// Who may read a locked reading's result, independent of email identity
// (docs/ACCESS-FLOW.md section 5). One grant per reading; a browser that
// merely knows the URL never gets one. Basis: guest | verified_session.
export const readingAccessGrants = pgTable(
  "reading_access_grants",
  {
    id: text("id").primaryKey(),
    readingId: text("reading_id")
      .notNull()
      .references(() => readings.id),
    browserSessionId: text("browser_session_id")
      .notNull()
      .references(() => browserSessions.id),
    basis: text("basis").notNull(), // guest | verified_session | legacy_email
    createdAt: epochMs("created_at").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
  },
  (t) => [uniqueIndex("reading_access_grants_reading_idx").on(t.readingId), index("reading_access_grants_expiry_idx").on(t.expiresAt)],
);

// Session-continuation OTP (docs/ACCESS-FLOW.md section 6): verifies the
// browser session, not a single reading. Separate from email_challenges so
// a code for one purpose can never satisfy the other.
export const sessionEmailChallenges = pgTable(
  "session_email_challenges",
  {
    id: text("id").primaryKey(),
    browserSessionId: text("browser_session_id")
      .notNull()
      .references(() => browserSessions.id),
    intendedEmail: text("intended_email").notNull(),
    codeHmac: text("code_hmac").notNull(),
    keyVersion: integer("key_version").notNull(),
    generation: integer("generation").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: epochMs("expires_at").notNull(),
    consumedAt: epochMs("consumed_at"),
    supersededAt: epochMs("superseded_at"),
    providerMessageId: text("provider_message_id"),
    sendStatus: text("send_status").notNull().default("pending"), // pending | accepted | failed
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("session_email_challenges_session_idx").on(t.browserSessionId, t.generation)],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    id: text("id").primaryKey(),
    identifierDigest: text("identifier_digest").notNull(),
    action: text("action").notNull(),
    windowStart: epochMs("window_start").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: epochMs("expires_at").notNull(),
  },
  (t) => [uniqueIndex("rate_limit_bucket_key_idx").on(t.identifierDigest, t.action, t.windowStart)],
);

export const deliveryEvents = pgTable("delivery_events", {
  id: text("id").primaryKey(),
  providerEventId: text("provider_event_id").notNull().unique(),
  messageId: text("message_id").notNull(),
  status: text("status").notNull(), // delivered | bounced | complained | ...
  occurredAt: epochMs("occurred_at").notNull(),
  createdAt: epochMs("created_at").notNull(),
});

// Added in the PLAN.md revision (section 6/7): bounce/complaint suppression
// on its own longer retention clock, independent of delivery_events (7 days).
export const suppressedEmails = pgTable("suppressed_emails", {
  id: text("id").primaryKey(),
  normalizedLookupHash: text("normalized_lookup_hash").notNull().unique(),
  reason: text("reason").notNull(), // hard_bounce | complaint
  firstSuppressedAt: epochMs("first_suppressed_at").notNull(),
  sourceEventId: text("source_event_id"),
});
