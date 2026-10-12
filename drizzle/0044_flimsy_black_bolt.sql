-- 家についての通知（猫を問わないもの）を持てるよう、通知に household_id を追加し、cat_id の NOT NULL を外す。
-- どちらか一方だけを必ず持つ（notifications_target_check）。SQLite では NOT NULL を外せないため、テーブルを作り直す。
--
-- D1 はトランザクション中の `PRAGMA foreign_keys=OFF` を無視し、外部キー制約が有効なまま実行される。
-- そのため DROP TABLE の暗黙の DELETE で、notifications を ON DELETE CASCADE で参照する
-- push_deliveries（Push の送信済み記録）の行も消えてしまう。作り直す前に退避し、作り直した後に戻す。
-- 0035 と同様に、外部キー制約の検査はコミット時まで遅らせる。
--
-- 既存の行はすべて cat_id を持つため、そのまま移せる。この列を知らない古いコードは cat_id を必ず入れて
-- INSERT するため、新しいコードのデプロイ前に適用できる。新しいコードは household_id を読むため、
-- マージ（デプロイ）より前に必ず適用すること
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__backup_push_deliveries` AS SELECT * FROM `push_deliveries`;--> statement-breakpoint
CREATE TABLE `__new_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text,
	`household_id` text,
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
	CONSTRAINT "notifications_target_check" CHECK((cat_id IS NULL) <> (household_id IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "cat_id", "household_id", "kind", "reference_id", "dedupe_key", "title", "body", "url", "due_at", "status", "snoozed_until", "read_at", "pushed_at", "created_at", "updated_at") SELECT "id", "cat_id", NULL, "kind", "reference_id", "dedupe_key", "title", "body", "url", "due_at", "status", "snoozed_until", "read_at", "pushed_at", "created_at", "updated_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
INSERT INTO `push_deliveries`("id", "notification_id", "subscription_id", "created_at") SELECT "id", "notification_id", "subscription_id", "created_at" FROM `__backup_push_deliveries`;--> statement-breakpoint
DROP TABLE `__backup_push_deliveries`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_status_due_at_idx` ON `notifications` (`status`,`due_at`);