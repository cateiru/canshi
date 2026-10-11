ALTER TABLE `users` ADD `email_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_hash_unique` ON `users` (`email_hash`);