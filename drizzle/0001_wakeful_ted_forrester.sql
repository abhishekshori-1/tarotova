CREATE TABLE "reading_access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"reading_id" text NOT NULL,
	"browser_session_id" text NOT NULL,
	"basis" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_email_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"browser_session_id" text NOT NULL,
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
ALTER TABLE "browser_sessions" ADD COLUMN "guest_reading_id" text;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD COLUMN "verified_email_id" text;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD COLUMN "verified_until" bigint;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "reading_access_grants" ADD CONSTRAINT "reading_access_grants_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_access_grants" ADD CONSTRAINT "reading_access_grants_browser_session_id_browser_sessions_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_email_challenges" ADD CONSTRAINT "session_email_challenges_browser_session_id_browser_sessions_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_access_grants_reading_idx" ON "reading_access_grants" USING btree ("reading_id");--> statement-breakpoint
CREATE INDEX "reading_access_grants_expiry_idx" ON "reading_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_email_challenges_session_idx" ON "session_email_challenges" USING btree ("browser_session_id","generation");--> statement-breakpoint
INSERT INTO "reading_access_grants" ("id", "reading_id", "browser_session_id", "basis", "created_at", "expires_at")
SELECT 'legacy_' || "id", "id", "browser_session_id", 'legacy_email', "verified_at", "access_expires_at"
FROM "readings"
WHERE "state" = 'verified' AND "verified_at" IS NOT NULL AND "access_expires_at" IS NOT NULL
ON CONFLICT DO NOTHING;