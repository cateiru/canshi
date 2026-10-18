CREATE TABLE `mcp_connection_usages` (
	`user_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`last_used_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `grant_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
