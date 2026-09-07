CREATE TABLE `food_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kcal_per_100g` real NOT NULL,
	`package_amount_g` real NOT NULL,
	`nutrition_type` text NOT NULL,
	`texture_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
