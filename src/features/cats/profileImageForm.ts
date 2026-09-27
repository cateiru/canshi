/**
 * 猫の編集フォームが送るプロフィール画像のフィールド。クライアント（`ProfileImageField`）と
 * サーバー（`updateCatAction`）の両方から参照する
 */

/** プロフィール画像をどうするか（`ProfileImageChange["type"]`） */
export const PROFILE_IMAGE_ACTION_FIELD = "profileImageAction";

/** 新しいプロフィール画像として切り抜いてアップロードした下書きの asset ID */
export const PROFILE_IMAGE_ASSET_ID_FIELD = "profileImageAssetId";

export type ProfileImageChange =
  | { type: "keep" }
  | { type: "set"; assetId: string }
  | { type: "remove" };

const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * フォームからプロフィール画像の変更内容を取り出す。フィールドがない・値が不正な場合は
 * 何も変更しない（`keep`）として扱い、意図せず画像を消さないようにする
 */
export function parseProfileImageChange(
  formData: FormData,
): ProfileImageChange {
  const action = formData.get(PROFILE_IMAGE_ACTION_FIELD);
  if (action === "remove") {
    return { type: "remove" };
  }
  if (action === "set") {
    const assetId = formData.get(PROFILE_IMAGE_ASSET_ID_FIELD);
    if (typeof assetId === "string" && ASSET_ID_PATTERN.test(assetId)) {
      return { type: "set", assetId };
    }
  }
  return { type: "keep" };
}
