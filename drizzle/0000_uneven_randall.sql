CREATE TABLE "browser_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	CONSTRAINT "browser_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_event_id" text NOT NULL,
	"message_id" text NOT NULL,
	"status" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "delivery_events_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "email_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"reading_id" text NOT NULL,
	"intended_email" text NOT NULL,
	"code_hmac" text NOT NULL,
	"key_version" integer NOT NULL,
	"generation" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" bigint NOT NULL,
	"consumed_at" bigint,
	"superseded_at" bigint,
	"provider_message_id" text,
	"send_status" text DEFAULT 'pending' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier_digest" text NOT NULL,
	"action" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" text PRIMARY KEY NOT NULL,
	"browser_session_id" text NOT NULL,
	"state" text DEFAULT 'drafting' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"focus" text DEFAULT 'general' NOT NULL,
	"shuffle_mapping" text NOT NULL,
	"selected_slots" text DEFAULT '[]' NOT NULL,
	"locked_slots" text,
	"resolved_card_ids" text,
	"deck_version" text NOT NULL,
	"spread_version" text NOT NULL,
	"content_version" text NOT NULL,
	"result_snapshot" text,
	"verified_email_id" text,
	"draft_expires_at" bigint NOT NULL,
	"access_expires_at" bigint,
	"verified_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressed_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"normalized_lookup_hash" text NOT NULL,
	"reason" text NOT NULL,
	"first_suppressed_at" bigint NOT NULL,
	"source_event_id" text,
	CONSTRAINT "suppressed_emails_normalized_lookup_hash_unique" UNIQUE("normalized_lookup_hash")
);
--> statement-breakpoint
CREATE TABLE "verified_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"normalized_lookup" text NOT NULL,
	"verified_at" bigint NOT NULL,
	"last_activity_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_challenges" ADD CONSTRAINT "email_challenges_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_browser_session_id_browser_sessions_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_verified_email_id_verified_emails_id_fk" FOREIGN KEY ("verified_email_id") REFERENCES "public"."verified_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_challenges_reading_idx" ON "email_challenges" USING btree ("reading_id","generation");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_bucket_key_idx" ON "rate_limit_buckets" USING btree ("identifier_digest","action","window_start");--> statement-breakpoint
CREATE INDEX "readings_session_idx" ON "readings" USING btree ("browser_session_id");--> statement-breakpoint
CREATE INDEX "readings_expiry_idx" ON "readings" USING btree ("draft_expires_at","access_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verified_emails_lookup_idx" ON "verified_emails" USING btree ("normalized_lookup");