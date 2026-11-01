CREATE TABLE `brushing_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`performed_at` integer NOT NULL,
	`duration_minutes` integer,
	`shed_amount` text,
	`has_mats` integer DEFAULT false NOT NULL,
	`has_skin_issue` integer DEFAULT false NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `brushing_records_cat_id_performed_at_idx` ON `brushing_records` (`cat_id`,`performed_at`);