CREATE TABLE `expense_record_hospital_visits` (
	`expense_record_id` text NOT NULL,
	`hospital_visit_id` text NOT NULL,
	PRIMARY KEY(`expense_record_id`, `hospital_visit_id`),
	FOREIGN KEY (`expense_record_id`) REFERENCES `expense_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_visit_id`) REFERENCES `hospital_visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_record_hospital_visits_hospital_visit_id_unique` ON `expense_record_hospital_visits` (`hospital_visit_id`);--> statement-breakpoint
-- 支出記録と通院記録の紐付けを 1 対 1（expense_records.hospital_visit_id）から中間テーブルへ移す。
-- 旧列には一意インデックスがあったため、1 件の通院記録に紐付く支出が複数になることはない
INSERT INTO `expense_record_hospital_visits` (`expense_record_id`, `hospital_visit_id`) SELECT `id`, `hospital_visit_id` FROM `expense_records` WHERE `hospital_visit_id` IS NOT NULL;--> statement-breakpoint
-- D1 はトランザクション中の `PRAGMA foreign_keys=OFF` を無視し、expense_record_cats などが参照している
-- expense_records を作り直せないため、外部キー制約の検査をコミット時まで遅らせる
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_expense_records` (
	`id` text PRIMARY KEY NOT NULL,
	`spent_at` integer NOT NULL,
	`amount_yen` integer NOT NULL,
	`category` text NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_expense_records`("id", "spent_at", "amount_yen", "category", "memo", "created_at", "updated_at") SELECT "id", "spent_at", "amount_yen", "category", "memo", "created_at", "updated_at" FROM `expense_records`;--> statement-breakpoint
DROP TABLE `expense_records`;--> statement-breakpoint
ALTER TABLE `__new_expense_records` RENAME TO `expense_records`;--> statement-breakpoint
PRAGMA defer_foreign_keys = off;--> statement-breakpoint
CREATE INDEX `expense_records_spent_at_idx` ON `expense_records` (`spent_at`);