/**
 * `media_assets.record_type` に使う識別子。
 * R2 のオブジェクトキーのプレフィックスにもなるため、英数字・アンダースコアのみで構成する
 */
export const MEDIA_RECORD_TYPES = [
  "poop_record",
  "vomit_record",
  "symptom",
  "medication",
  "hospital_visit",
  "cat_photo",
  "food_product",
  "expense",
] as const;

export type MediaRecordType = (typeof MEDIA_RECORD_TYPES)[number];

export function isMediaRecordType(value: unknown): value is MediaRecordType {
  return (
    typeof value === "string" &&
    (MEDIA_RECORD_TYPES as readonly string[]).includes(value)
  );
}

/**
 * 開発確認用フォーム（src/app/dev/media）からのアップロードに使う特別な種別。
 * 実在するレコードに紐付けずにアップロードできる。本番では受け付けない
 */
export const DEV_MEDIA_RECORD_TYPE = "dev";

/**
 * フォームで先にアップロードし、まだ記録に紐付けていない下書きの種別。
 * `recordId` には自身の asset ID を入れる。記録の保存時に実際の種別・記録 ID へ付け替える
 */
export const PENDING_MEDIA_RECORD_TYPE = "pending";
