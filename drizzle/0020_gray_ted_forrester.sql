CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`notify_time` text DEFAULT '09:00' NOT NULL,
	`timezone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference_id` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`params` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_settings_cat_kind_reference_unique` ON `notification_settings` (`cat_id`,`kind`,`reference_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference_id` text,
	`dedupe_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`snoozed_until` integer,
	`read_at` integer,
	`pushed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_status_due_at_idx` ON `notifications` (`status`,`due_at`);