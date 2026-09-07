CREATE TABLE `feeding_preset_items` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`food_product_id` text NOT NULL,
	`given_amount_g` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `feeding_presets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_product_id`) REFERENCES `food_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feeding_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
