CREATE TABLE "reading_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"reading_id" text NOT NULL,
	"kind" text DEFAULT 'interpretation' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" bigint NOT NULL,
	"model" text,
	"prompt_version" text NOT NULL,
	"content_version" text NOT NULL,
	"safety_category" text,
	"output" text,
	"error_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"completed_at" bigint
);
--> statement-breakpoint
ALTER TABLE "reading_generations" ADD CONSTRAINT "reading_generations_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_generations_reading_kind_idx" ON "reading_generations" USING btree ("reading_id","kind");