ALTER TABLE `food_products` ADD `manufacturer` text;--> statement-breakpoint
ALTER TABLE `food_products` ADD `life_stages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `food_products` ADD `target_breed` text;