import { and, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { type MediaAsset, mediaAssets } from "@/db/schema";
import type { MediaAssetRepository } from "../domain/mediaAssetRepository";
import { PENDING_MEDIA_RECORD_TYPE } from "../domain/recordTypes";

/** D1 に保存する `MediaAssetRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createMediaAssetRepository(
  d1?: D1Database,
): MediaAssetRepository {
  return {
    async listPendingForUser(ids, userId) {
      const db = getDb(d1);
      const rows: MediaAsset[] = [];
      // recordType と uploadedByUserId の分を 2 個予約する
      for (const chunk of chunkForBoundParameters(ids, 2)) {
        rows.push(
          ...(await db
            .select()
            .from(mediaAssets)
            .where(
              and(
                eq(mediaAssets.recordType, PENDING_MEDIA_RECORD_TYPE),
                eq(mediaAssets.uploadedByUserId, userId),
                inArray(mediaAssets.id, chunk),
              ),
            )),
        );
      }
      return rows;
    },

    async assign(recordType, recordId, catId, items, userId) {
      const db = getDb(d1);
      for (const item of items) {
        await db
          .update(mediaAssets)
          .set(
            item.isPending
              ? {
                  recordType,
                  recordId,
                  catId,
                  sortOrder: item.sortOrder,
                }
              : { sortOrder: item.sortOrder },
          )
          .where(
            and(
              eq(mediaAssets.id, item.id),
              // 同時に別の記録へ紐付けられていないことを条件にする
              eq(
                mediaAssets.recordType,
                item.isPending ? PENDING_MEDIA_RECORD_TYPE : recordType,
              ),
              item.isPending
                ? eq(mediaAssets.uploadedByUserId, userId)
                : undefined,
            ),
          );
      }
    },
  };
}
