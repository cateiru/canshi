-- ログイン中の端末一覧のため、セッションに画面で使う ID（id）とログイン時の User-Agent（user_agent）を追加する。
-- SQLite の ALTER TABLE ADD COLUMN では乱数のような非定数の既定値を付けられないため、テーブルを作り直す。
-- id は DB 側の既定値で振るため、既存のセッションにも行ごとに別の値が入り、ログイン中の端末はログアウトされない。
-- この列を知らない古いコードの INSERT でも id が入るため、新しいコードのデプロイ前に適用してよい。
-- sessions を参照する外部キーはないため、外部キー制約の検査を遅らせる必要はない
CREATE TABLE `__new_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("token_hash", "user_id", "expires_at", "created_at") SELECT "token_hash", "user_id", "expires_at", "created_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_unique` ON `sessions` (`id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);
