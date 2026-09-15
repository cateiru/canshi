CREATE TABLE `expense_record_cats` (
	`expense_record_id` text NOT NULL,
	`cat_id` text NOT NULL,
	PRIMARY KEY(`expense_record_id`, `cat_id`),
	FOREIGN KEY (`expense_record_id`) REFERENCES `expense_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `expense_record_cats_cat_id_idx` ON `expense_record_cats` (`cat_id`);--> statement-breakpoint
CREATE TABLE `expense_records` (
	`id` text PRIMARY KEY NOT NULL,
	`spent_at` integer NOT NULL,
	`amount_yen` integer NOT NULL,
	`category` text NOT NULL,
	`hospital_visit_id` text,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`hospital_visit_id`) REFERENCES `hospital_visits`(`id`) ON UPDATE no action ON DELETE no action
);
