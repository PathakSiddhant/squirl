CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_kind_idx` ON `accounts` (`kind`);--> statement-breakpoint
CREATE INDEX `accounts_sort_idx` ON `accounts` (`sort_order`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`flow` text NOT NULL,
	`icon` text DEFAULT 'Circle' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `categories_flow_idx` ON `categories` (`flow`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`direction` text NOT NULL,
	`opened_on` text NOT NULL,
	`due_on` text,
	`interest_kind` text DEFAULT 'none' NOT NULL,
	`rate_bps_per_month` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_on` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "debts_rate_nonneg" CHECK("debts"."rate_bps_per_month" >= 0)
);
--> statement-breakpoint
CREATE INDEX `debts_person_idx` ON `debts` (`person_id`);--> statement-breakpoint
CREATE INDEX `debts_status_idx` ON `debts` (`status`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`seq` integer NOT NULL,
	`due_on` text NOT NULL,
	`amount` integer NOT NULL,
	`principal_part` integer NOT NULL,
	`interest_part` integer NOT NULL,
	`status` text DEFAULT 'due' NOT NULL,
	`paid_on` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installments_loan_seq_idx` ON `installments` (`loan_id`,`seq`);--> statement-breakpoint
CREATE INDEX `installments_due_idx` ON `installments` (`due_on`);--> statement-breakpoint
CREATE INDEX `installments_status_idx` ON `installments` (`status`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`lender` text NOT NULL,
	`principal` integer NOT NULL,
	`taken_on` text NOT NULL,
	`tenure_months` integer NOT NULL,
	`interest_model` text DEFAULT 'emi_known' NOT NULL,
	`rate_bps_per_annum` integer DEFAULT 0 NOT NULL,
	`emi_amount` integer DEFAULT 0 NOT NULL,
	`processing_fee` integer DEFAULT 0 NOT NULL,
	`first_due_on` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`closed_on` text,
	`note` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "loans_tenure_positive" CHECK("loans"."tenure_months" > 0),
	CONSTRAINT "loans_principal_positive" CHECK("loans"."principal" > 0)
);
--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`handle` text,
	`note` text,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_handle_idx` ON `people` (`handle`);--> statement-breakpoint
CREATE TABLE `reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`day` text NOT NULL,
	`expected_balance` integer NOT NULL,
	`actual_balance` integer NOT NULL,
	`difference` integer NOT NULL,
	`transaction_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reconciliations_account_idx` ON `reconciliations` (`account_id`);--> statement-breakpoint
CREATE INDEX `reconciliations_day_idx` ON `reconciliations` (`day`);--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` text,
	`counter_account_id` text,
	`category_id` text,
	`cadence` text DEFAULT 'monthly' NOT NULL,
	`anchor` integer DEFAULT 1 NOT NULL,
	`next_due_on` text NOT NULL,
	`last_posted_on` text,
	`method` text DEFAULT 'bank' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`counter_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_next_due_idx` ON `recurring` (`next_due_on`);--> statement-breakpoint
CREATE INDEX `recurring_active_idx` ON `recurring` (`active`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` text,
	`counter_account_id` text,
	`category_id` text,
	`person_id` text,
	`debt_id` text,
	`loan_id` text,
	`installment_id` text,
	`interest_part` integer DEFAULT 0 NOT NULL,
	`method` text DEFAULT 'upi' NOT NULL,
	`note` text,
	`raw_input` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`counter_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_amount_positive" CHECK("transactions"."amount" > 0),
	CONSTRAINT "transactions_interest_within_amount" CHECK("transactions"."interest_part" >= 0 AND "transactions"."interest_part" <= "transactions"."amount"),
	CONSTRAINT "transactions_day_shape" CHECK("transactions"."day" LIKE '____-__-__')
);
--> statement-breakpoint
CREATE INDEX `transactions_day_idx` ON `transactions` (`day`);--> statement-breakpoint
CREATE INDEX `transactions_kind_idx` ON `transactions` (`kind`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_person_idx` ON `transactions` (`person_id`);--> statement-breakpoint
CREATE INDEX `transactions_debt_idx` ON `transactions` (`debt_id`);--> statement-breakpoint
CREATE INDEX `transactions_loan_idx` ON `transactions` (`loan_id`);