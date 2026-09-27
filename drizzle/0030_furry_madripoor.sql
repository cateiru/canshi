-- 写真記録（cat_photos）の廃止。プロフィールに使っている写真は猫のプロフィール画像（cat_profile）として引き継ぐ
UPDATE `media_assets` SET `record_type` = 'cat_profile', `record_id` = `cat_id`, `sort_order` = 0 WHERE `record_type` = 'cat_photo' AND `id` IN (SELECT `profile_media_asset_id` FROM `cats` WHERE `profile_media_asset_id` IS NOT NULL);--> statement-breakpoint
-- それ以外の写真は記録に紐付かない下書き（pending）に戻す。SQL からは R2 のオブジェクトを削除できないため、
-- 期限切れの下書きの掃除（アップロードのたびに実行）で R2 のオブジェクトごと削除させる
UPDATE `media_assets` SET `record_type` = 'pending', `record_id` = `id`, `cat_id` = NULL WHERE `record_type` = 'cat_photo';--> statement-breakpoint
DROP TABLE `cat_photos`;--> statement-breakpoint
ALTER TABLE `cats` DROP COLUMN `is_profile_pinned`;
