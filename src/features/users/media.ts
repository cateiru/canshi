/**
 * media_assets.record_type に使う識別子。アイコン画像はユーザーそのものに紐付くため、
 * record_id はユーザーの ID になる（猫には紐付かないため cat_id は null）。
 *
 * 記録への添付ではないため `MEDIA_RECORD_TYPES` には含めない。`POST /api/media` から
 * 任意のユーザー宛てにアップロードされないよう、下書きを経由してプロフィール設定の保存時にだけ紐付ける
 */
export const USER_ICON_MEDIA_TYPE = "user_icon";
