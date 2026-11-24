CREATE TABLE `api_access_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`api_token_id` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`api_token_id`) REFERENCES `api_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `api_access_logs_api_token_id_created_at_idx` ON `api_access_logs` (`api_token_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer,
	`excluded_household_ids` text DEFAULT '[]' NOT NULL,
	`excluded_cat_ids` text DEFAULT '[]' NOT NULL,
	`excluded_record_types` text DEFAULT '{}' NOT NULL,
	`writable_record_types` text DEFAULT '{}' NOT NULL,
	`household_operations` text DEFAULT '{}' NOT NULL,
	`catalog_operations` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_id_idx` ON `api_tokens` (`user_id`);--> statement-breakpoint
ALTER TABLE `record_change_logs` ADD `api_token_id` text;