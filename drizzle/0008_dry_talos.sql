CREATE TABLE `hospital_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`symptom_id` text,
	`reserved_at` integer,
	`visited_at` integer NOT NULL,
	`reason` text NOT NULL,
	`diagnosis` text,
	`examination_results` text,
	`treatment` text,
	`next_visit_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`symptom_id`) REFERENCES `symptoms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `medications` ADD `hospital_visit_id` text REFERENCES hospital_visits(id);--> statement-breakpoint
ALTER TABLE `symptoms` ADD `hospital_visit_id` text REFERENCES hospital_visits(id);