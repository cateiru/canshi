import { inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { cats } from "@/db/schema";

/**
 * 指定したメディアをプロフィールにしている猫の参照を外す。
 * media_assets の行を削除する前に呼ぶ（cats.profile_media_asset_id の外部キー制約のため）
 */
export async function detachProfileImages(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }
  const db = getDb();
  // D1 のバインドパラメーター上限を超えないよう、set の値 1 個分を差し引いて分割する
  for (const ids of chunkForBoundParameters(assetIds, 1)) {
    await db
      .update(cats)
      .set({ profileMediaAssetId: null })
      .where(inArray(cats.profileMediaAssetId, ids));
  }
}
