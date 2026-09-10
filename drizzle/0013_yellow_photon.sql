ALTER TABLE `media_assets` ADD `size_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `thumbnail_size_bytes` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `media_assets_record_idx` ON `media_assets` (`record_type`,`record_id`);