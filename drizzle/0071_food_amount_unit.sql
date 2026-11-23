ALTER TABLE `catalog_food_products` ADD `amount_unit` text DEFAULT 'g' NOT NULL;--> statement-breakpoint
ALTER TABLE `food_products` ADD `amount_unit` text DEFAULT 'g' NOT NULL;