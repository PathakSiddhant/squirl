-- Signal's tables: a local inbox for content from deliberately chosen
-- YouTube channels.
--
-- Every table is prefixed `signal_`, because Squirl keeps one database file
-- and a table belongs to exactly one application. Nothing here touches
-- Ledger's tables, and this migration is purely additive: it creates and it
-- never drops, so applying it to a database holding real money data cannot
-- disturb any of it.
--
-- Written by hand rather than generated. drizzle-kit needs an interactive
-- prompt to tell a new column from a rename, and this runs in a
-- non-interactive shell; migration 0001 was written the same way for the same
-- reason. Everything below is CREATE, which is the safest possible thing to
-- hand-write and the easiest to read against the schema it mirrors.

CREATE TABLE `signal_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_categories_slug_idx` ON `signal_categories` (`slug`);
--> statement-breakpoint
CREATE TABLE `signal_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `signal_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_topics_slug_idx` ON `signal_topics` (`slug`);
--> statement-breakpoint
CREATE TABLE `signal_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`youtube_id` text NOT NULL,
	`uploads_playlist_id` text,
	`title` text NOT NULL,
	`handle` text,
	`description` text,
	`thumbnail_url` text,
	`subscriber_count` integer,
	`category_id` text,
	`category_locked` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`added_at` integer NOT NULL,
	`last_synced_at` integer,
	`last_seen_video_id` text,
	`sync_status` text DEFAULT 'never' NOT NULL,
	`last_error` text,
	`failure_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `signal_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_channels_youtube_idx` ON `signal_channels` (`youtube_id`);
--> statement-breakpoint
CREATE INDEX `signal_channels_enabled_idx` ON `signal_channels` (`enabled`);
--> statement-breakpoint
CREATE INDEX `signal_channels_category_idx` ON `signal_channels` (`category_id`);
--> statement-breakpoint
CREATE TABLE `signal_channel_topics` (
	`channel_id` text NOT NULL,
	`topic_id` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `signal_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `signal_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_channel_topics_pair_idx` ON `signal_channel_topics` (`channel_id`,`topic_id`);
--> statement-breakpoint
CREATE INDEX `signal_channel_topics_channel_idx` ON `signal_channel_topics` (`channel_id`);
--> statement-breakpoint
CREATE TABLE `signal_content` (
	`id` text PRIMARY KEY NOT NULL,
	`youtube_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`thumbnail_url` text,
	`kind` text NOT NULL,
	`duration_seconds` integer,
	`published_at` integer NOT NULL,
	`scheduled_at` integer,
	`started_at` integer,
	`state` text DEFAULT 'unseen' NOT NULL,
	`snoozed_until` integer,
	`processed_at` integer,
	`discovered_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `signal_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `signal_content_snooze_needs_time` CHECK ((`state` <> 'snoozed') OR (`snoozed_until` IS NOT NULL)),
	CONSTRAINT `signal_content_duration_sane` CHECK (`duration_seconds` IS NULL OR `duration_seconds` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_content_youtube_idx` ON `signal_content` (`youtube_id`);
--> statement-breakpoint
CREATE INDEX `signal_content_state_idx` ON `signal_content` (`state`,`published_at`);
--> statement-breakpoint
CREATE INDEX `signal_content_channel_idx` ON `signal_content` (`channel_id`,`published_at`);
--> statement-breakpoint
CREATE INDEX `signal_content_kind_idx` ON `signal_content` (`kind`);
--> statement-breakpoint
CREATE INDEX `signal_content_snooze_idx` ON `signal_content` (`snoozed_until`);
