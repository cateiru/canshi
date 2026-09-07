CREATE TABLE `symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`symptom_type` text NOT NULL,
	`onset_at` integer NOT NULL,
	`frequency_or_severity` text,
	`appetite_note` text,
	`energy_note` text,
	`status` text NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
