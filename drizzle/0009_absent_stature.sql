CREATE TABLE `feeding_record_items` (
	`id` text PRIMARY KEY NOT NULL,
	`feeding_record_id` text NOT NULL,
	`food_product_id` text NOT NULL,
	`given_amount_g` real NOT NULL,
	`leftover_amount_g` real NOT NULL,
	`estimated_intake_g` real NOT NULL,
	`estimated_kcal` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`feeding_record_id`) REFERENCES `feeding_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_product_id`) REFERENCES `food_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `feeding_record_items` ("id", "feeding_record_id", "food_product_id", "given_amount_g", "leftover_amount_g", "estimated_intake_g", "estimated_kcal", "sort_order") SELECT "id", "id", "food_product_id", "given_amount_g", "leftover_amount_g", "estimated_intake_g", "estimated_kcal", 0 FROM `feeding_records`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_feeding_records` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_feeding_records`("id", "cat_id", "occurred_at", "created_at", "updated_at") SELECT "id", "cat_id", "occurred_at", "created_at", "updated_at" FROM `feeding_records`;--> statement-breakpoint
DROP TABLE `feeding_records`;--> statement-breakpoint
ALTER TABLE `__new_feeding_records` RENAME TO `feeding_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;