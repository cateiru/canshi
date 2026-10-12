CREATE TABLE `oauth_kv_entries` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `oauth_kv_entries_expires_at_idx` ON `oauth_kv_entries` (`expires_at`);