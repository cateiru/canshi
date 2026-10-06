import type { MediaAsset } from "@/db/schema";
import { getCatForUser } from "@/features/households/queries";
import { PENDING_MEDIA_RECORD_TYPE } from "./recordTypes";

/**
 * ユーザーがメディアを参照・削除してよいかを判定する。
 *
 * - 記録に紐付く前の下書きは、アップロードしたユーザー本人だけに許可する
 * - 猫に紐付くメディアは、その猫の家に所属していることを求める
 * - 猫に紐付かないメディア（ごはん商品の画像・支出の添付）は、全ユーザーで共通のデータのため、
 *   家に関係なくログイン中のユーザーなら許可する
 */
export async function canAccessMediaAsset(
  userId: string,
  asset: Pick<MediaAsset, "catId" | "recordType" | "uploadedByUserId">,
): Promise<boolean> {
  if (asset.recordType === PENDING_MEDIA_RECORD_TYPE) {
    return asset.uploadedByUserId === userId;
  }
  if (asset.catId == null) {
    return true;
  }
  return (await getCatForUser(userId, asset.catId)) != null;
}
