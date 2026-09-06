CREATE TABLE `ai_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`ai_output` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	`user_correction` text,
	`media_asset_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sex` text NOT NULL,
	`birth_date` text,
	`breed` text,
	`adopted_at` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`object_key` text NOT NULL,
	`thumbnail_object_key` text,
	`mime_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
