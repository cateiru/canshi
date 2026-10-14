-- 共通のごはん商品（管理画面から登録し、家のごはん商品の登録時に検索して追加する。#283）のテーブルと、
-- 家のごはん商品の追加元の列を追加する。テーブル・nullable の列を追加するだけなので、古いコードのまま
-- 先に適用しても影響はない。新しいコードはこのテーブル・列が無いとごはん商品の一覧が表示できないため、
-- マージ（デプロイ）より前に pnpm db:migrate:remote で適用すること。
CREATE TABLE `catalog_food_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text,
	`kcal_per_100g` real NOT NULL,
	`package_amount_g` real NOT NULL,
	`package_unit` text,
	`nutrition_type` text NOT NULL,
	`texture_type` text NOT NULL,
	`life_stages` text DEFAULT '[]' NOT NULL,
	`target_breed` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_food_products_manufacturer_name_idx` ON `catalog_food_products` (`manufacturer`,`name`);--> statement-breakpoint
-- drizzle-kit は ALTER TABLE ... ADD の外部キーに ON DELETE を出力しないため、スキーマ定義
-- （onDelete: "set null"）に合わせて手で追記した。管理画面で共通のごはん商品を削除しても、
-- 家に追加済みの商品は追加元が NULL になるだけで残る
ALTER TABLE `food_products` ADD `catalog_food_product_id` text REFERENCES catalog_food_products(id) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `food_products_household_id_catalog_food_product_id_unique` ON `food_products` (`household_id`,`catalog_food_product_id`);
