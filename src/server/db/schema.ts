import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Local SQLite stand-in for the Supabase Postgres schema in PLAN.md section 7.
// Table shapes mirror the plan's field lists; swapping the driver for
// postgres.js later should not require renaming columns.

export const browserSessions = sqliteTable("browser_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const readings = sqliteTable(
  "readings",
  {
    id: text("id").primaryKey(), // opaque public id
    browserSessionId: text("browser_session_id")
      .notNull()
      .references(() => browserSessions.id),
    state: text("state").notNull().default("drafting"), // drafting | locked | verified
    revision: integer("revision").notNull().default(0),
    focus: text("focus").notNull().default("general"),
    shuffleMapping: text("shuffle_mapping").notNull(), // JSON: slot index -> card id (private)
    selectedSlots: text("selected_slots").notNull().default("[]"), // JSON int[], editable, order matters
    lockedSlots: text("locked_slots"), // JSON int[3], set once, order = Situation/Challenge/Guidance
    resolvedCardIds: text("resolved_card_ids"), // JSON string[3], set at lock
    deckVersion: text("deck_version").notNull(),
    spreadVersion: text("spread_version").notNull(),
    contentVersion: text("content_version").notNull(),
    resultSnapshot: text("result_snapshot"), // JSON, frozen at lock time
    verifiedEmailId: text("verified_email_id").references(() => verifiedEmails.id),
    draftExpiresAt: integer("draft_expires_at").notNull(),
    accessExpiresAt: integer("access_expires_at"),
    verifiedAt: integer("verified_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("readings_session_idx").on(t.browserSessionId), index("readings_expiry_idx").on(t.draftExpiresAt, t.accessExpiresAt)],
);

export const verifiedEmails = sqliteTable(
  "verified_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    normalizedLookup: text("normalized_lookup").notNull(),
    verifiedAt: integer("verified_at").notNull(),
    lastActivityAt: integer("last_activity_at").notNull(),
  },
  (t) => [uniqueIndex("verified_emails_lookup_idx").on(t.normalizedLookup)],
);

export const emailChallenges = sqliteTable(
  "email_challenges",
  {
    id: text("id").primaryKey(),
    readingId: text("reading_id")
      .notNull()
      .references(() => readings.id),
    intendedEmail: text("intended_email").notNull(),
    codeHmac: text("code_hmac").notNull(),
    keyVersion: integer("key_version").notNull(),
    generation: integer("generation").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    supersededAt: integer("superseded_at"),
    providerMessageId: text("provider_message_id"),
    sendStatus: text("send_status").notNull().default("pending"), // pending | accepted | failed
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("email_challenges_reading_idx").on(t.readingId, t.generation)],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    id: text("id").primaryKey(),
    identifierDigest: text("identifier_digest").notNull(),
    action: text("action").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [uniqueIndex("rate_limit_bucket_key_idx").on(t.identifierDigest, t.action, t.windowStart)],
);

export const deliveryEvents = sqliteTable(
  "delivery_events",
  {
    id: text("id").primaryKey(),
    providerEventId: text("provider_event_id").notNull().unique(),
    messageId: text("message_id").notNull(),
    status: text("status").notNull(), // delivered | bounced | complained | ...
    occurredAt: integer("occurred_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
);

// Added in the PLAN.md revision (section 6/7): bounce/complaint suppression
// on its own longer retention clock, independent of delivery_events (7 days).
export const suppressedEmails = sqliteTable(
  "suppressed_emails",
  {
    id: text("id").primaryKey(),
    normalizedLookupHash: text("normalized_lookup_hash").notNull().unique(),
    reason: text("reason").notNull(), // hard_bounce | complaint
    firstSuppressedAt: integer("first_suppressed_at").notNull(),
    sourceEventId: text("source_event_id"),
  },
);
