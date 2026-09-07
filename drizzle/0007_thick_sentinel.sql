CREATE TABLE `medication_doses` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`was_administered` integer DEFAULT true NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`symptom_id` text,
	`name` text NOT NULL,
	`dose_amount` text NOT NULL,
	`doses_per_day` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`symptom_id`) REFERENCES `symptoms`(`id`) ON UPDATE no action ON DELETE no action
);
