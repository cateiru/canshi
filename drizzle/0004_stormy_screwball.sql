CREATE TABLE `weight_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`input_method` text NOT NULL,
	`combined_weight_kg` real,
	`human_weight_kg` real,
	`cat_weight_kg` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
