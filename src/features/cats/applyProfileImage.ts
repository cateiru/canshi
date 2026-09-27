import { and, eq, like, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats, mediaAssets } from "@/db/schema";
import { PENDING_MEDIA_RECORD_TYPE } from "@/features/media/recordTypes";
import { deleteMediaAssetRows } from "@/features/media/storage";
import { CAT_PROFILE_MEDIA_TYPE } from "./media";
import type { ProfileImageChange } from "./profileImageForm";

/**
 * プロフィール画像の表示位置・ズーム・回転の列。以前の写真記録から選んだ画像
 * （切り抜く前の元画像）の表示にだけ使う。フロントエンドで切り抜いてからアップロードした
 * 画像には不要なため、画像を差し替える・外すときは必ず消す
 */
const CLEARED_PROFILE_CROP = {
  profileCropX: null,
  profileCropY: null,
  profileCropZoom: null,
  profileCropRotation: null,
};

/**
 * 猫に紐付くプロフィール画像のうち、`keepAssetId` 以外を R2 のオブジェクトごと削除する
 */
async function deleteOtherProfileAssets(
  catId: string,
  keepAssetId: string | null,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.catId, catId),
        eq(mediaAssets.recordType, CAT_PROFILE_MEDIA_TYPE),
        keepAssetId ? ne(mediaAssets.id, keepAssetId) : undefined,
      ),
    );
  await deleteMediaAssetRows(rows);
}

/**
 * フォームで選んだプロフィール画像の変更を反映する。
 *
 * - set：切り抜いてアップロード済みの下書きを猫のプロフィール画像として紐付け、それまでの画像を削除する
 * - remove：プロフィール画像を外して削除する
 * - keep：何もしない
 *
 * 反映できなかった場合はフォーム用のエラーメッセージを返す
 */
export async function applyProfileImageChange(
  catId: string,
  change: ProfileImageChange,
): Promise<string | undefined> {
  if (change.type === "keep") {
    return undefined;
  }
  const db = getDb();
  try {
    if (change.type === "remove") {
      await db
        .update(cats)
        .set({
          profileMediaAssetId: null,
          ...CLEARED_PROFILE_CROP,
          updatedAt: new Date(),
        })
        .where(eq(cats.id, catId));
      await deleteOtherProfileAssets(catId, null);
      return undefined;
    }

    // 下書き（画像）のときだけ紐付ける。同時に別の記録へ紐付けられていないことも条件にする
    const claimed = await db
      .update(mediaAssets)
      .set({
        recordType: CAT_PROFILE_MEDIA_TYPE,
        recordId: catId,
        catId,
        sortOrder: 0,
      })
      .where(
        and(
          eq(mediaAssets.id, change.assetId),
          eq(mediaAssets.recordType, PENDING_MEDIA_RECORD_TYPE),
          like(mediaAssets.mimeType, "image/%"),
        ),
      )
      .returning({ id: mediaAssets.id });
    if (claimed.length === 0) {
      return "猫の情報は保存しましたが、プロフィール画像が見つかりませんでした。もう一度画像を選び直してから保存してください";
    }
    // 先に新しい画像へ付け替えてから古い画像を消す（途中で失敗しても画像なしにならないように）
    await db
      .update(cats)
      .set({
        profileMediaAssetId: change.assetId,
        ...CLEARED_PROFILE_CROP,
        updatedAt: new Date(),
      })
      .where(eq(cats.id, catId));
    await deleteOtherProfileAssets(catId, change.assetId);
    return undefined;
  } catch (error) {
    console.error("プロフィール画像の保存に失敗しました", error);
    return "猫の情報は保存しましたが、プロフィール画像を保存できませんでした。もう一度保存してください";
  }
}
