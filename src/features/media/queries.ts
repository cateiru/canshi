import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type MediaAsset, mediaAssets } from "@/db/schema";

const ORDER = [asc(mediaAssets.sortOrder), asc(mediaAssets.createdAt)];

export async function getMediaAssetById(
  id: string,
): Promise<MediaAsset | null> {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  return asset ?? null;
}

export async function listMediaAssetsByRecord(
  recordType: string,
  recordId: string,
): Promise<MediaAsset[]> {
  const db = getDb();
  return db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, recordType),
        eq(mediaAssets.recordId, recordId),
      ),
    )
    .orderBy(...ORDER);
}

/**
 * 複数レコード分のメディアをまとめて取得し、recordId ごとにグループ化して返す。
 * 一覧ページで N+1 クエリにならないようにするためのもの
 */
export async function listMediaAssetsByRecords(
  recordType: string,
  recordIds: string[],
): Promise<Map<string, MediaAsset[]>> {
  const grouped = new Map<string, MediaAsset[]>();
  if (recordIds.length === 0) {
    return grouped;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, recordType),
        inArray(mediaAssets.recordId, recordIds),
      ),
    )
    .orderBy(...ORDER);
  for (const row of rows) {
    const list = grouped.get(row.recordId) ?? [];
    list.push(row);
    grouped.set(row.recordId, list);
  }
  return grouped;
}

/** 元データとサムネイルを合わせた現在の使用容量（バイト） */
export async function sumMediaStorageBytes(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0) + coalesce(sum(${mediaAssets.thumbnailSizeBytes}), 0)`,
    })
    .from(mediaAssets);
  return Number(row?.total ?? 0);
}

/** 同一レコード内で次に使う表示順 */
export async function nextMediaSortOrder(
  recordType: string,
  recordId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      max: sql<number | null>`max(${mediaAssets.sortOrder})`,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, recordType),
        eq(mediaAssets.recordId, recordId),
      ),
    );
  return row?.max == null ? 0 : Number(row.max) + 1;
}
