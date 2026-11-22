CREATE TABLE `record_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`record_types` text NOT NULL,
	`include_media` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`failure_reason` text,
	`object_key` text,
	`size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `record_exports_household_id_created_at_idx` ON `record_exports` (`household_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `record_exports_household_id_running_unique` ON `record_exports` (`household_id`) WHERE status IN ('pending', 'processing');