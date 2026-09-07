CREATE TABLE `feeding_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`food_product_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`given_amount_g` real NOT NULL,
	`leftover_amount_g` real NOT NULL,
	`estimated_intake_g` real NOT NULL,
	`estimated_kcal` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_product_id`) REFERENCES `food_products`(`id`) ON UPDATE no action ON DELETE no action
);
