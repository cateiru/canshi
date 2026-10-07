import type { MediaAsset } from "@/db/schema";
import { getCatForUser, sharesHousehold } from "@/features/households/queries";
import { USER_ICON_MEDIA_TYPE } from "@/features/users/media";
import { PENDING_MEDIA_RECORD_TYPE } from "./recordTypes";

type AccessCheckedAsset = Pick<
  MediaAsset,
  "catId" | "recordType" | "recordId" | "uploadedByUserId"
>;

/**
 * ユーザーがメディアを参照してよいかを判定する。
 *
 * - 記録に紐付く前の下書きは、アップロードした本人だけに許可する
 * - ユーザーのアイコン画像は、本人と、同じ家に所属するメンバーに許可する
 * - 猫に紐付くメディアは、その猫の家に所属していることを求める
 * - 猫に紐付かないメディア（ごはん商品の画像・支出の添付）は、全ユーザーで共通のデータのため、
 *   家に関係なくログイン中のユーザーなら許可する
 */
export async function canAccessMediaAsset(
  userId: string,
  asset: AccessCheckedAsset,
): Promise<boolean> {
  if (asset.recordType === PENDING_MEDIA_RECORD_TYPE) {
    return asset.uploadedByUserId === userId;
  }
  if (asset.recordType === USER_ICON_MEDIA_TYPE) {
    return sharesHousehold(userId, asset.recordId);
  }
  if (asset.catId == null) {
    return true;
  }
  return (await getCatForUser(userId, asset.catId)) != null;
}

/**
 * ユーザーがメディアを削除してよいかを判定する。ユーザーのアイコン画像は、同じ家のメンバーでも
 * 本人以外には削除させない。それ以外は参照できるメディアなら削除できる
 */
export async function canDeleteMediaAsset(
  userId: string,
  asset: AccessCheckedAsset,
): Promise<boolean> {
  if (asset.recordType === USER_ICON_MEDIA_TYPE) {
    return asset.recordId === userId;
  }
  return canAccessMediaAsset(userId, asset);
}
