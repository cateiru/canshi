DROP INDEX `users_email_hash_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email_hash`;