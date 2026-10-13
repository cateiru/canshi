CREATE TABLE `feeding_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`time` text NOT NULL,
	`notify_at_time` integer DEFAULT true NOT NULL,
	`remind_if_not_recorded` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeding_schedules_household_id_time_unique` ON `feeding_schedules` (`household_id`,`time`);--> statement-breakpoint
CREATE INDEX `feeding_records_cat_id_occurred_at_idx` ON `feeding_records` (`cat_id`,`occurred_at`);