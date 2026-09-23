/**
 * 添付付きフォームが送信するフィールド。クライアント（`useMediaFormAction`）と
 * サーバー（`syncRecordMediaFromForm`）の両方から参照する
 */

/**
 * フォームから送る添付の asset ID（表示順）。`useMediaFormAction` が送信時に詰める
 */
export const MEDIA_ASSET_IDS_FIELD = "mediaAssetIds";

/**
 * 添付欄を含むフォームであることを示す印。
 * これがないフォーム（添付欄のない古いクライアントなど）では添付を一切変更しない
 * （「ID が 1 つもない」と区別できないと、既存の添付をすべて消してしまうため）
 */
export const MEDIA_FIELD_MARKER = "mediaAttachmentField";

const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * フォームから添付の asset ID 一覧を取り出す。添付欄のないフォームなら null
 */
export function parseMediaAssetIds(formData: FormData): string[] | null {
  if (formData.get(MEDIA_FIELD_MARKER) == null) {
    return null;
  }
  const ids: string[] = [];
  for (const value of formData.getAll(MEDIA_ASSET_IDS_FIELD)) {
    if (
      typeof value === "string" &&
      ASSET_ID_PATTERN.test(value) &&
      !ids.includes(value)
    ) {
      ids.push(value);
    }
  }
  return ids;
}
