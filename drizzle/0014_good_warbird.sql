CREATE TABLE `cat_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`taken_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `cats` ADD `profile_media_asset_id` text REFERENCES media_assets(id);--> statement-breakpoint
ALTER TABLE `cats` ADD `is_profile_pinned` integer DEFAULT false NOT NULL;