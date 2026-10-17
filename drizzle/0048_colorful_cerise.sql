CREATE TABLE `mcp_permissions` (
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`excluded_household_ids` text DEFAULT '[]' NOT NULL,
	`excluded_cat_ids` text DEFAULT '[]' NOT NULL,
	`excluded_record_types` text DEFAULT '{}' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `client_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
