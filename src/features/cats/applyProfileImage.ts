import { and, eq, exists, like, notExists } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats, mediaAssets } from "@/db/schema";
import { PENDING_MEDIA_RECORD_TYPE } from "@/features/media/recordTypes";
import { deleteMediaAssetRows } from "@/features/media/storage";
import { CAT_PROFILE_MEDIA_TYPE } from "./media";
import type { ProfileImageChange } from "./profileImageForm";

/**
 * 猫に紐付くプロフィール画像のうち、その時点で猫が参照していない画像（差し替え・削除前の古い画像）を
 * R2 のオブジェクトごと削除する。
 *
 * 紐付けと猫の参照の更新は同じ batch で行うため、紐付け済みで参照されていない画像は古い画像だけになる。
 * 参照先を 1 つの SELECT の中で除外することで、同時に別のリクエストが設定した画像を消さないようにする
 */
async function deleteReplacedProfileAssets(catId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.catId, catId),
        eq(mediaAssets.recordType, CAT_PROFILE_MEDIA_TYPE),
        notExists(
          db
            .select({ id: cats.id })
            .from(cats)
            .where(
              and(
                eq(cats.id, catId),
                eq(cats.profileMediaAssetId, mediaAssets.id),
              ),
            ),
        ),
      ),
    );
  await deleteMediaAssetRows(rows);
}

/**
 * フォームで選んだプロフィール画像の変更を反映する。
 *
 * - set：切り抜いてアップロード済みの下書きを猫のプロフィール画像として紐付け、それまでの画像を削除する。
 *   途中で失敗しても同じ asset ID で保存し直せば、紐付け済みの画像のまま処理を再開する
 * - remove：プロフィール画像を外して削除する
 * - keep：何もしない
 *
 * 反映できなかった場合はフォーム用のエラーメッセージを返す
 */
export async function applyProfileImageChange(
  catId: string,
  change: ProfileImageChange,
  userId: string,
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
          updatedAt: new Date(),
        })
        .where(eq(cats.id, catId));
      await deleteReplacedProfileAssets(catId);
      return undefined;
    }

    // 下書き（画像）の紐付けと猫の参照の更新を 1 つの batch（トランザクション）で行う。
    // 途中で失敗しても下書きのまま戻るため、保存し直せる
    const [, referenced] = await db.batch([
      // 下書き（画像）のときだけ紐付ける。同時に別の記録へ紐付けられていないことと、
      // 保存したユーザー本人がアップロードした下書きであることも条件にする
      db
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
            eq(mediaAssets.uploadedByUserId, userId),
            like(mediaAssets.mimeType, "image/%"),
          ),
        ),
      // この猫に紐付いた画像（前回の保存で紐付け済みのものを含む）のときだけ参照を付け替える
      db
        .update(cats)
        .set({
          profileMediaAssetId: change.assetId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cats.id, catId),
            exists(
              db
                .select({ id: mediaAssets.id })
                .from(mediaAssets)
                .where(
                  and(
                    eq(mediaAssets.id, change.assetId),
                    eq(mediaAssets.recordType, CAT_PROFILE_MEDIA_TYPE),
                    eq(mediaAssets.catId, catId),
                    like(mediaAssets.mimeType, "image/%"),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: cats.id }),
    ]);
    if (referenced.length === 0) {
      return "猫の情報は保存しましたが、プロフィール画像が見つかりませんでした。もう一度画像を選び直してから保存してください";
    }
    // 新しい画像へ付け替えた後に古い画像を消す（途中で失敗しても画像なしにならないように）
    await deleteReplacedProfileAssets(catId);
    return undefined;
  } catch (error) {
    console.error("プロフィール画像の保存に失敗しました", error);
    return "猫の情報は保存しましたが、プロフィール画像を保存できませんでした。もう一度保存してください";
  }
}
