ALTER TABLE "email_challenges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_challenges" CASCADE;--> statement-breakpoint
ALTER TABLE "readings" DROP CONSTRAINT "readings_verified_email_id_verified_emails_id_fk";
--> statement-breakpoint
ALTER TABLE "readings" DROP COLUMN "verified_email_id";--> statement-breakpoint
ALTER TABLE "readings" DROP COLUMN "verified_at";