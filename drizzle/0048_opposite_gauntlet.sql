CREATE TABLE `mcp_permissions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`excluded_household_ids` text DEFAULT '[]' NOT NULL,
	`excluded_cat_ids` text DEFAULT '[]' NOT NULL,
	`excluded_record_types` text DEFAULT '{}' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
