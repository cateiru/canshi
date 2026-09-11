import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { catPhotos, cats, mediaAssets } from "@/db/schema";
import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";

/**
 * 猫のプロフィール画像（cats.profile_media_asset_id）を写真の状態に合わせて更新する。
 *
 * - 固定中（is_profile_pinned）で、固定した写真がまだ存在すれば何もしない
 * - それ以外は、撮影日時が最新の写真記録の先頭の画像をプロフィールにする（写真がなければ null）
 * - 固定していた写真が削除されていた場合は固定を解除して最新の写真に戻す
 *
 * 写真の追加・削除のたびに呼ぶ
 */
export async function syncCatProfileImage(catId: string): Promise<void> {
  const db = getDb();
  const [cat] = await db
    .select({
      profileMediaAssetId: cats.profileMediaAssetId,
      isProfilePinned: cats.isProfilePinned,
      profileCropX: cats.profileCropX,
      profileCropY: cats.profileCropY,
    })
    .from(cats)
    .where(eq(cats.id, catId))
    .limit(1);
  if (!cat) {
    return;
  }

  if (cat.isProfilePinned && cat.profileMediaAssetId) {
    const [pinned] = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, cat.profileMediaAssetId))
      .limit(1);
    if (pinned) {
      return;
    }
  }

  const [latest] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .innerJoin(catPhotos, eq(mediaAssets.recordId, catPhotos.id))
    .where(
      and(
        eq(mediaAssets.recordType, CAT_PHOTO_MEDIA_TYPE),
        eq(catPhotos.catId, catId),
        like(mediaAssets.mimeType, "image/%"),
      ),
    )
    .orderBy(
      desc(catPhotos.takenAt),
      asc(mediaAssets.sortOrder),
      asc(mediaAssets.createdAt),
    )
    .limit(1);

  const nextId = latest?.id ?? null;
  const cropAlreadyCleared =
    cat.profileCropX == null && cat.profileCropY == null;
  if (
    nextId === cat.profileMediaAssetId &&
    !cat.isProfilePinned &&
    cropAlreadyCleared
  ) {
    return;
  }
  await db
    .update(cats)
    .set({
      profileMediaAssetId: nextId,
      // 固定した写真が消えた場合はここに来るので固定を解除する
      isProfilePinned: false,
      // 固定を外した写真の crop 位置を次の写真に引き継ぐ意味はないため必ず消す
      profileCropX: null,
      profileCropY: null,
      updatedAt: new Date(),
    })
    .where(eq(cats.id, catId));
}

/**
 * 指定したメディアをプロフィールにしている猫の参照を外し、その猫の ID を返す。
 * media_assets の行を削除する前に呼ぶ（cats.profile_media_asset_id の外部キー制約のため）
 */
export async function detachProfileImages(
  assetIds: string[],
): Promise<string[]> {
  if (assetIds.length === 0) {
    return [];
  }
  const db = getDb();
  const catIds: string[] = [];
  // D1 のバインドパラメーター上限を超えないよう、set の値 1 個分を差し引いて分割する
  for (const ids of chunkForBoundParameters(assetIds, 1)) {
    const affected = await db
      .update(cats)
      .set({ profileMediaAssetId: null })
      .where(inArray(cats.profileMediaAssetId, ids))
      .returning({ id: cats.id });
    for (const row of affected) {
      catIds.push(row.id);
    }
  }
  return catIds;
}
