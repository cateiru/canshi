import { and, eq, exists, like, notExists } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mediaAssets, users } from "@/db/schema";
import type { ProfileImageChange } from "@/features/cats/profileImageForm";
import { PENDING_MEDIA_RECORD_TYPE } from "@/features/media/recordTypes";
import { deleteMediaAssetRows } from "@/features/media/storage";
import { USER_ICON_MEDIA_TYPE } from "./media";

/**
 * ユーザーに紐付くアイコン画像のうち、その時点でユーザーが参照していない画像（差し替え・削除前の古い画像）を
 * R2 のオブジェクトごと削除する。
 *
 * 紐付けとユーザーの参照の更新は同じ batch で行うため、紐付け済みで参照されていない画像は古い画像だけになる。
 * 参照先を 1 つの SELECT の中で除外することで、同時に別のリクエストが設定した画像を消さないようにする
 */
async function deleteReplacedUserIcons(userId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, USER_ICON_MEDIA_TYPE),
        eq(mediaAssets.recordId, userId),
        notExists(
          db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.id, userId),
                eq(users.iconMediaAssetId, mediaAssets.id),
              ),
            ),
        ),
      ),
    );
  await deleteMediaAssetRows(rows);
}

/**
 * プロフィール設定で選んだアイコン画像の変更を反映する。
 *
 * - set：切り抜いてアップロード済みの下書きをユーザーのアイコンとして紐付け、それまでの画像を削除する。
 *   途中で失敗しても同じ asset ID で保存し直せば、紐付け済みの画像のまま処理を再開する
 * - remove：アイコンを外して削除する
 * - keep：何もしない
 *
 * 反映できなかった場合はフォーム用のエラーメッセージを返す
 */
export async function applyUserIconChange(
  userId: string,
  change: ProfileImageChange,
): Promise<string | undefined> {
  if (change.type === "keep") {
    return undefined;
  }
  const db = getDb();
  try {
    if (change.type === "remove") {
      await db
        .update(users)
        .set({ iconMediaAssetId: null, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await deleteReplacedUserIcons(userId);
      return undefined;
    }

    // 下書き（画像）の紐付けとユーザーの参照の更新を 1 つの batch（トランザクション）で行う。
    // 途中で失敗しても下書きのまま戻るため、保存し直せる
    const [, referenced] = await db.batch([
      // 本人がアップロードした下書き（画像）のときだけ紐付ける
      db
        .update(mediaAssets)
        .set({
          recordType: USER_ICON_MEDIA_TYPE,
          recordId: userId,
          catId: null,
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
      // このユーザーに紐付いた画像（前回の保存で紐付け済みのものを含む）のときだけ参照を付け替える
      db
        .update(users)
        .set({ iconMediaAssetId: change.assetId, updatedAt: new Date() })
        .where(
          and(
            eq(users.id, userId),
            exists(
              db
                .select({ id: mediaAssets.id })
                .from(mediaAssets)
                .where(
                  and(
                    eq(mediaAssets.id, change.assetId),
                    eq(mediaAssets.recordType, USER_ICON_MEDIA_TYPE),
                    eq(mediaAssets.recordId, userId),
                    like(mediaAssets.mimeType, "image/%"),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: users.id }),
    ]);
    if (referenced.length === 0) {
      return "名前は保存しましたが、アイコン画像が見つかりませんでした。もう一度画像を選び直してから保存してください";
    }
    // 新しい画像へ付け替えた後に古い画像を消す（途中で失敗しても画像なしにならないように）
    await deleteReplacedUserIcons(userId);
    return undefined;
  } catch (error) {
    console.error("アイコン画像の保存に失敗しました", error);
    return "名前は保存しましたが、アイコン画像を保存できませんでした。もう一度保存してください";
  }
}
