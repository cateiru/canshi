import type { MediaAsset } from "@/db/schema";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import {
  getCatForUser,
  getHouseholdForUser,
  sharesHousehold,
} from "@/features/households/queries";
import { USER_ICON_MEDIA_TYPE } from "@/features/users/media";
import { type MediaRecordOwner, resolveMediaRecordOwner } from "./recordOwner";
import { PENDING_MEDIA_RECORD_TYPE } from "./recordTypes";

type AccessCheckedAsset = Pick<
  MediaAsset,
  "catId" | "recordType" | "recordId" | "uploadedByUserId"
>;

/**
 * ユーザーが添付先のレコードを扱えるかを判定する。家に属するレコード（支出）はその家に、
 * 猫に紐付くレコードはその猫の家に所属していることを求める。どちらでもないレコード
 * （ごはん商品）は全ユーザーで共通のデータのため、ログイン中のユーザーなら許可する
 */
export async function canAccessMediaRecordOwner(
  userId: string,
  owner: MediaRecordOwner,
): Promise<boolean> {
  if (owner.householdId !== undefined) {
    return (
      owner.householdId != null &&
      (await getHouseholdForUser(userId, owner.householdId)) != null
    );
  }
  if (owner.catId != null) {
    return (await getCatForUser(userId, owner.catId)) != null;
  }
  return true;
}

/**
 * ユーザーがメディアを参照してよいかを判定する。
 *
 * - 記録に紐付く前の下書きは、アップロードした本人だけに許可する
 * - ユーザーのアイコン画像は、本人と、同じ家に所属するメンバーに許可する
 * - 支出の添付は、支出の家に所属していることを求める
 * - 猫に紐付くメディアは、その猫の家に所属していることを求める
 * - 猫に紐付かないメディア（ごはん商品の画像）は、全ユーザーで共通のデータのため、
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
  if (asset.recordType === EXPENSE_MEDIA_TYPE) {
    const owner = await resolveMediaRecordOwner(
      EXPENSE_MEDIA_TYPE,
      asset.recordId,
    );
    return owner != null && canAccessMediaRecordOwner(userId, owner);
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
