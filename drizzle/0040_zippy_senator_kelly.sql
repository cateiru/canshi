ALTER TABLE `feeding_presets` ADD `household_id` text REFERENCES households(id);--> statement-breakpoint
CREATE INDEX `feeding_presets_household_id_created_at_idx` ON `feeding_presets` (`household_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `food_products` ADD `household_id` text REFERENCES households(id);--> statement-breakpoint
CREATE INDEX `food_products_household_id_created_at_idx` ON `food_products` (`household_id`,`created_at`);