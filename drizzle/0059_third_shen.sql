-- 共通のごはん商品のリクエスト（#355）を保存する catalog_food_product_requests を作る。
-- あわせて、リクエストの完了をリクエストしたユーザーだけに知らせるため、通知に user_id を追加し、
-- cat_id・household_id・user_id のどれか 1 つだけを必ず持つ（notifications_target_check）ようにする。
-- SQLite では CHECK 制約を変えられないため、テーブルを作り直す（0044 と同じ方式）。
--
-- D1 はトランザクション中の `PRAGMA foreign_keys=OFF` を無視し、外部キー制約が有効なまま実行される。
-- そのため DROP TABLE の暗黙の DELETE で、notifications を ON DELETE CASCADE で参照する
-- push_deliveries（Push の送信済み記録）の行も消えてしまう。作り直す前に退避し、作り直した後に戻す。
-- 外部キー制約の検査はコミット時まで遅らせる。
--
-- 既存の行は cat_id か household_id のどちらか一方を持つため、そのまま移せる。この列を知らない古いコードは
-- cat_id か household_id のどちらか一方を入れて INSERT するため、新しい CHECK 制約も満たす。
-- 新しいコードは user_id とリクエストのテーブルを使うため、マージ（デプロイ）より前に必ず適用すること
CREATE TABLE `catalog_food_product_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`search_query` text NOT NULL,
	`label` text NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_food_product_requests_open_unique` ON `catalog_food_product_requests` (`user_id`,`search_query`) WHERE completed_at IS NULL;--> statement-breakpoint
CREATE INDEX `catalog_food_product_requests_completed_at_created_at_idx` ON `catalog_food_product_requests` (`completed_at`,`created_at`);--> statement-breakpoint
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__backup_push_deliveries` AS SELECT * FROM `push_deliveries`;--> statement-breakpoint
CREATE TABLE `__new_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text,
	`household_id` text,
	`user_id` text,
	`kind` text NOT NULL,
	`reference_id` text,
	`dedupe_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`snoozed_until` integer,
	`read_at` integer,
	`pushed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cat_id`) REFERENCES `cats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notifications_target_check" CHECK((cat_id IS NOT NULL) + (household_id IS NOT NULL) + (user_id IS NOT NULL) = 1)
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "cat_id", "household_id", "user_id", "kind", "reference_id", "dedupe_key", "title", "body", "url", "due_at", "status", "snoozed_until", "read_at", "pushed_at", "created_at", "updated_at") SELECT "id", "cat_id", "household_id", NULL, "kind", "reference_id", "dedupe_key", "title", "body", "url", "due_at", "status", "snoozed_until", "read_at", "pushed_at", "created_at", "updated_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
INSERT INTO `push_deliveries`("id", "notification_id", "subscription_id", "created_at") SELECT "id", "notification_id", "subscription_id", "created_at" FROM `__backup_push_deliveries`;--> statement-breakpoint
DROP TABLE `__backup_push_deliveries`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_status_due_at_idx` ON `notifications` (`status`,`due_at`);