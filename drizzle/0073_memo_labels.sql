CREATE TABLE `memo_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memo_labels_household_id_name_unique` ON `memo_labels` (`household_id`,`name`);--> statement-breakpoint
CREATE TABLE `memo_record_labels` (
	`memo_record_id` text NOT NULL,
	`memo_label_id` text NOT NULL,
	PRIMARY KEY(`memo_record_id`, `memo_label_id`),
	FOREIGN KEY (`memo_record_id`) REFERENCES `memo_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`memo_label_id`) REFERENCES `memo_labels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memo_record_labels_memo_label_id_idx` ON `memo_record_labels` (`memo_label_id`);