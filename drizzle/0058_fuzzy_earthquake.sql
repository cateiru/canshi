CREATE TABLE `push_test_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_test_requests_subscription_id_unique` ON `push_test_requests` (`subscription_id`);