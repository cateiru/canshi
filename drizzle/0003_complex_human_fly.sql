CREATE TABLE `poop_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`count` integer NOT NULL,
	`amount` text,
	`color` text,
	`consistency` text NOT NULL,
	`has_blood` integer DEFAULT false NOT NULL,
	`has_foreign_object` integer DEFAULT false NOT NULL,
	`appetite_note` text,
	`energy_note` text,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
