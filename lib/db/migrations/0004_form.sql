-- Form's tables: a personal record of physical state, kept in phases.
--
-- Every table is prefixed `form_`, because Squirl keeps one database file and
-- a table belongs to exactly one application. Nothing here touches Ledger's
-- tables or Signal's, and this migration is purely additive: it creates and it
-- never drops, so applying it to a database holding real money and a real
-- content queue cannot disturb either of them.
--
-- Written by hand rather than generated, for the reason recorded in 0002:
-- drizzle-kit needs an interactive prompt to tell a new column from a rename
-- and this runs in a non-interactive shell. Everything below is CREATE.
--
-- On the units in these columns: nothing is stored as a decimal. Body mass is
-- grams, length is millimetres, volume is millilitres, energy is milli-kcal,
-- macronutrients are milligrams, and a food quantity is milli-units of its own
-- unit. Form multiplies constantly — a proportion of a per-100g row applied to
-- every nutrient on it, then summed across a day and averaged across a week —
-- and integers are the only way that arithmetic stays exact.

CREATE TABLE `form_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`height_mm` integer,
	`birth_year` integer,
	`sex` text DEFAULT 'unspecified' NOT NULL,
	`activity` text DEFAULT 'light' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`height_unit` text DEFAULT 'cm' NOT NULL,
	`volume_unit` text DEFAULT 'ml' NOT NULL,
	`weigh_cadence` text DEFAULT 'daily' NOT NULL,
	`weigh_every_days` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `form_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_day` text NOT NULL,
	`target_day` text NOT NULL,
	`ended_day` text,
	`start_weight_g` integer,
	`target_weight_g` integer,
	`final_weight_g` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- "Exactly one active phase" is the most structural rule in the product, so it
-- is enforced where it cannot be forgotten rather than hoped for in a query. A
-- partial index leaves any number of completed and planned phases alone.
CREATE UNIQUE INDEX `form_phases_one_active_idx` ON `form_phases` (`status`) WHERE `status` = 'active';
--> statement-breakpoint
CREATE INDEX `form_phases_status_idx` ON `form_phases` (`status`,`start_day`);
--> statement-breakpoint
CREATE TABLE `form_phase_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`metric` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`target` integer,
	`recommended` integer,
	`direction` text DEFAULT 'at-least' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `form_phases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_phase_metrics_pair_idx` ON `form_phase_metrics` (`phase_id`,`metric`);
--> statement-breakpoint
CREATE INDEX `form_phase_metrics_phase_idx` ON `form_phase_metrics` (`phase_id`);
--> statement-breakpoint
-- Append-only. A target that changes on Thursday must not retroactively change
-- what Monday was measured against, so completion for a day reads the row whose
-- `effective_from` is the latest one on or before it.
CREATE TABLE `form_target_history` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`metric` text NOT NULL,
	`target` integer,
	`direction` text DEFAULT 'at-least' NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `form_phases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `form_target_history_lookup_idx` ON `form_target_history` (`phase_id`,`metric`,`effective_from`);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_target_history_day_idx` ON `form_target_history` (`phase_id`,`metric`,`effective_from`);
--> statement-breakpoint
CREATE TABLE `form_days` (
	`day` text PRIMARY KEY NOT NULL,
	`phase_id` text,
	`note` text,
	`nutrition_untracked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `form_phases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `form_days_phase_idx` ON `form_days` (`phase_id`,`day`);
--> statement-breakpoint
CREATE TABLE `form_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer,
	`untracked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_entries_pair_idx` ON `form_entries` (`day`,`metric`);
--> statement-breakpoint
CREATE INDEX `form_entries_metric_idx` ON `form_entries` (`metric`,`day`);
--> statement-breakpoint
CREATE TABLE `form_weights` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`grams` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "form_weights_sane" CHECK("form_weights"."grams" > 0 AND "form_weights"."grams" < 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_weights_day_idx` ON `form_weights` (`day`);
--> statement-breakpoint
CREATE TABLE `form_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`ref_quantity` integer NOT NULL,
	`ref_unit` text DEFAULT 'g' NOT NULL,
	`energy_mcal` integer DEFAULT 0 NOT NULL,
	`protein_mg` integer DEFAULT 0 NOT NULL,
	`carbs_mg` integer,
	`fat_mg` integer,
	`fiber_mg` integer,
	`confidence` text DEFAULT 'known' NOT NULL,
	`last_used_at` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "form_foods_ref_positive" CHECK("form_foods"."ref_quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `form_foods_name_idx` ON `form_foods` (`name`);
--> statement-breakpoint
CREATE INDEX `form_foods_recent_idx` ON `form_foods` (`last_used_at`);
--> statement-breakpoint
-- The nutrients here are computed at log time and then frozen, and the name is
-- copied rather than joined. Correcting a saved food must not silently rewrite
-- what last March's breakfasts contained, and deleting one must not blank out
-- a year of days that referred to it.
CREATE TABLE `form_food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text DEFAULT 'g' NOT NULL,
	`energy_mcal` integer DEFAULT 0 NOT NULL,
	`protein_mg` integer DEFAULT 0 NOT NULL,
	`carbs_mg` integer,
	`fat_mg` integer,
	`fiber_mg` integer,
	`confidence` text DEFAULT 'known' NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `form_foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `form_food_logs_day_idx` ON `form_food_logs` (`day`);
--> statement-breakpoint
CREATE INDEX `form_food_logs_food_idx` ON `form_food_logs` (`food_id`);
--> statement-breakpoint
CREATE TABLE `form_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`site` text NOT NULL,
	`value_mm` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_measurements_pair_idx` ON `form_measurements` (`day`,`site`);
--> statement-breakpoint
CREATE INDEX `form_measurements_site_idx` ON `form_measurements` (`site`,`day`);
--> statement-breakpoint
-- Photo bytes live on disk in `data/form-photos/`, beside the database file,
-- and only the filename is stored here. They are the largest thing Form holds
-- by an order of magnitude, and a database that has to be rewritten because a
-- photo was added is a backup story nobody wants. Copying `data/` still copies
-- everything.
CREATE TABLE `form_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`pose` text DEFAULT 'front' NOT NULL,
	`file` text NOT NULL,
	`width` integer,
	`height` integer,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `form_photos_day_idx` ON `form_photos` (`day`,`pose`);
--> statement-breakpoint
CREATE TABLE `form_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text,
	`body` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `form_phases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `form_notes_recent_idx` ON `form_notes` (`created_at`);
