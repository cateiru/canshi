-- ごはん記録・プリセットに「厳格」「あいまい」の記録方法（mode）を追加する。
-- あいまいモードではグラム単位の量・推定値を持たないため、明細の該当列から NOT NULL を外し、
-- 代わりに段階での量（given_amount_level・leftover_level）を持たせる。
-- D1 はトランザクション中の `PRAGMA foreign_keys=OFF` を無視するため、0031 と同様に
-- 外部キー制約の検査をコミット時まで遅らせてから明細テーブルを作り直す
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_feeding_preset_items` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`food_product_id` text NOT NULL,
	`given_amount_g` real,
	`given_amount_level` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `feeding_presets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_product_id`) REFERENCES `food_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_feeding_preset_items`("id", "preset_id", "food_product_id", "given_amount_g", "sort_order") SELECT "id", "preset_id", "food_product_id", "given_amount_g", "sort_order" FROM `feeding_preset_items`;--> statement-breakpoint
DROP TABLE `feeding_preset_items`;--> statement-breakpoint
ALTER TABLE `__new_feeding_preset_items` RENAME TO `feeding_preset_items`;--> statement-breakpoint
CREATE TABLE `__new_feeding_record_items` (
	`id` text PRIMARY KEY NOT NULL,
	`feeding_record_id` text NOT NULL,
	`food_product_id` text NOT NULL,
	`given_amount_g` real,
	`leftover_amount_g` real,
	`estimated_intake_g` real,
	`estimated_kcal` real,
	`given_amount_level` text,
	`leftover_level` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`feeding_record_id`) REFERENCES `feeding_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_product_id`) REFERENCES `food_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_feeding_record_items`("id", "feeding_record_id", "food_product_id", "given_amount_g", "leftover_amount_g", "estimated_intake_g", "estimated_kcal", "sort_order") SELECT "id", "feeding_record_id", "food_product_id", "given_amount_g", "leftover_amount_g", "estimated_intake_g", "estimated_kcal", "sort_order" FROM `feeding_record_items`;--> statement-breakpoint
DROP TABLE `feeding_record_items`;--> statement-breakpoint
ALTER TABLE `__new_feeding_record_items` RENAME TO `feeding_record_items`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;--> statement-breakpoint
ALTER TABLE `feeding_presets` ADD `mode` text DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE `feeding_records` ADD `mode` text DEFAULT 'strict' NOT NULL;
