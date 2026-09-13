CREATE TABLE `browser_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `browser_sessions_token_hash_unique` ON `browser_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `delivery_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_event_id` text NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_events_provider_event_id_unique` ON `delivery_events` (`provider_event_id`);--> statement-breakpoint
CREATE TABLE `email_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`reading_id` text NOT NULL,
	`intended_email` text NOT NULL,
	`code_hmac` text NOT NULL,
	`key_version` integer NOT NULL,
	`generation` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`superseded_at` integer,
	`provider_message_id` text,
	`send_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reading_id`) REFERENCES `readings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_challenges_reading_idx` ON `email_challenges` (`reading_id`,`generation`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier_digest` text NOT NULL,
	`action` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_bucket_key_idx` ON `rate_limit_buckets` (`identifier_digest`,`action`,`window_start`);--> statement-breakpoint
CREATE TABLE `readings` (
	`id` text PRIMARY KEY NOT NULL,
	`browser_session_id` text NOT NULL,
	`state` text DEFAULT 'drafting' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`focus` text DEFAULT 'general' NOT NULL,
	`shuffle_mapping` text NOT NULL,
	`selected_slots` text DEFAULT '[]' NOT NULL,
	`locked_slots` text,
	`resolved_card_ids` text,
	`deck_version` text NOT NULL,
	`spread_version` text NOT NULL,
	`content_version` text NOT NULL,
	`result_snapshot` text,
	`verified_email_id` text,
	`draft_expires_at` integer NOT NULL,
	`access_expires_at` integer,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`browser_session_id`) REFERENCES `browser_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_email_id`) REFERENCES `verified_emails`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `readings_session_idx` ON `readings` (`browser_session_id`);--> statement-breakpoint
CREATE INDEX `readings_expiry_idx` ON `readings` (`draft_expires_at`,`access_expires_at`);--> statement-breakpoint
CREATE TABLE `suppressed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_lookup_hash` text NOT NULL,
	`reason` text NOT NULL,
	`first_suppressed_at` integer NOT NULL,
	`source_event_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppressed_emails_normalized_lookup_hash_unique` ON `suppressed_emails` (`normalized_lookup_hash`);--> statement-breakpoint
CREATE TABLE `verified_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`normalized_lookup` text NOT NULL,
	`verified_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verified_emails_lookup_idx` ON `verified_emails` (`normalized_lookup`);