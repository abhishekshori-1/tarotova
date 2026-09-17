CREATE TABLE "journey_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"browser_session_id" text NOT NULL,
	"reading_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"template_slug" text NOT NULL,
	"template_version" text NOT NULL,
	"template_snapshot" text NOT NULL,
	"initial_question" text NOT NULL,
	"stage" text DEFAULT 'frame' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"completed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"expected_revision" integer NOT NULL,
	"destination" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_runs" ADD CONSTRAINT "journey_runs_browser_session_id_browser_sessions_id_fk" FOREIGN KEY ("browser_session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_runs" ADD CONSTRAINT "journey_runs_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transitions" ADD CONSTRAINT "journey_transitions_journey_id_journey_runs_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_runs_submission_idx" ON "journey_runs" USING btree ("browser_session_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_runs_reading_idx" ON "journey_runs" USING btree ("reading_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_transitions_submission_idx" ON "journey_transitions" USING btree ("journey_id","submission_id");