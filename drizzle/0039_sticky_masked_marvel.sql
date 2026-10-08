DROP INDEX `expense_records_spent_at_idx`;--> statement-breakpoint
ALTER TABLE `expense_records` ADD `household_id` text REFERENCES households(id);--> statement-breakpoint
CREATE INDEX `expense_records_household_id_spent_at_idx` ON `expense_records` (`household_id`,`spent_at`);--> statement-breakpoint
-- 既存の支出記録は、関連する猫のうち最初に登録された猫の家に属させる
UPDATE `expense_records` SET `household_id` = (SELECT `cats`.`household_id` FROM `expense_record_cats` INNER JOIN `cats` ON `cats`.`id` = `expense_record_cats`.`cat_id` WHERE `expense_record_cats`.`expense_record_id` = `expense_records`.`id` AND `cats`.`household_id` IS NOT NULL ORDER BY `cats`.`created_at`, `cats`.`id` LIMIT 1);--> statement-breakpoint
-- 関連する猫がいない（または猫が家に未所属の）支出記録は、家が 1 つだけならその家に属させる。
-- 家が複数ある場合は決められないため NULL のまま残す（どのユーザーからも見えない）
UPDATE `expense_records` SET `household_id` = (SELECT `id` FROM `households`) WHERE `household_id` IS NULL AND (SELECT COUNT(*) FROM `households`) = 1;--> statement-breakpoint
-- 関連する猫・通院記録は支出記録と同じ家のものに限るため、別の家の猫との紐付けを外す
DELETE FROM `expense_record_cats` WHERE EXISTS (SELECT 1 FROM `expense_records` INNER JOIN `cats` ON `cats`.`id` = `expense_record_cats`.`cat_id` WHERE `expense_records`.`id` = `expense_record_cats`.`expense_record_id` AND `expense_records`.`household_id` <> `cats`.`household_id`);--> statement-breakpoint
DELETE FROM `expense_record_hospital_visits` WHERE EXISTS (SELECT 1 FROM `expense_records` INNER JOIN `hospital_visits` ON `hospital_visits`.`id` = `expense_record_hospital_visits`.`hospital_visit_id` INNER JOIN `cats` ON `cats`.`id` = `hospital_visits`.`cat_id` WHERE `expense_records`.`id` = `expense_record_hospital_visits`.`expense_record_id` AND `expense_records`.`household_id` <> `cats`.`household_id`);
