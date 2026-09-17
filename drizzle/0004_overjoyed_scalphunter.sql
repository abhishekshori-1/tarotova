CREATE TABLE "reading_followups" (
	"id" text PRIMARY KEY NOT NULL,
	"reading_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"safety_category" text,
	"output" text,
	"error_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" bigint NOT NULL,
	"prompt_version" text NOT NULL,
	"review_version" text NOT NULL,
	"content_version" text NOT NULL,
	"model" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"completed_at" bigint
);
--> statement-breakpoint
ALTER TABLE "reading_followups" ADD CONSTRAINT "reading_followups_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_followups_submission_idx" ON "reading_followups" USING btree ("reading_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_followups_sequence_idx" ON "reading_followups" USING btree ("reading_id","sequence");