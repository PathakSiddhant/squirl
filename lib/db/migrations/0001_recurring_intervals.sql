-- Rebuilds `recurring` for arbitrary intervals and real auto-debits.
--
-- Replaces cadence/anchor (monthly or weekly only) with intervalUnit plus
-- intervalCount, so a plan can bill every 3 months or every year. Adds
-- startsOn and postedCount, which together derive every occurrence from the
-- original date rather than by stepping the previous one forward, and autoPost
-- to distinguish a charge the bank takes on its own from one you confirm.
--
-- Written by hand rather than generated: drizzle-kit needs an interactive
-- prompt to tell a rename from a drop, and this runs in a non-interactive
-- shell. A straight rebuild is safe here because the table carries no rows
-- that predate the feature having any UI.
DROP TABLE IF EXISTS `recurring`;
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` text,
	`counter_account_id` text,
	`category_id` text,
	`interval_unit` text DEFAULT 'month' NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`posted_count` integer DEFAULT 0 NOT NULL,
	`next_due_on` text NOT NULL,
	`last_posted_on` text,
	`auto_post` integer DEFAULT false NOT NULL,
	`method` text DEFAULT 'auto' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`counter_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "recurring_interval_positive" CHECK("recurring"."interval_count" > 0),
	CONSTRAINT "recurring_amount_positive" CHECK("recurring"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `recurring_next_due_idx` ON `recurring` (`next_due_on`);--> statement-breakpoint
CREATE INDEX `recurring_active_idx` ON `recurring` (`active`);
