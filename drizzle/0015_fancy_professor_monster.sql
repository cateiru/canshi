CREATE TABLE `water_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`measurement_method` text NOT NULL,
	`supplied_amount_ml` real NOT NULL,
	`remaining_amount_ml` real,
	`estimated_intake_ml` real,
	`has_spill` integer DEFAULT false NOT NULL,
	`was_water_changed` integer DEFAULT false NOT NULL,
	`subjective_amount` text,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
