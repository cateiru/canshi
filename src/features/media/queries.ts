import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
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
  // D1 のバインドパラメーター上限を超えないよう、recordType の 1 個分を差し引いて分割する。
  // レコード単位で分割するので、同じレコードのメディアが複数のチャンクにまたがることはない
  for (const ids of chunkForBoundParameters(recordIds, 1)) {
    const rows = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.recordType, recordType),
          inArray(mediaAssets.recordId, ids),
        ),
      )
      .orderBy(...ORDER);
    for (const row of rows) {
      const list = grouped.get(row.recordId) ?? [];
      list.push(row);
      grouped.set(row.recordId, list);
    }
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

export type MediaRecordRef = { recordType: string; recordId: string };

/**
 * 記録種別をまたいで複数レコードのメディアをまとめて取得する（タイムライン用）。
 * `${recordType}:${recordId}` をキーにしたマップで返す
 */
export async function listMediaAssetsForRecords(
  refs: MediaRecordRef[],
): Promise<Map<string, MediaAsset[]>> {
  const grouped = new Map<string, MediaAsset[]>();
  if (refs.length === 0) {
    return grouped;
  }
  const idsByType = new Map<string, string[]>();
  for (const ref of refs) {
    const ids = idsByType.get(ref.recordType) ?? [];
    ids.push(ref.recordId);
    idsByType.set(ref.recordType, ids);
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      or(
        ...[...idsByType.entries()].map(([recordType, ids]) =>
          and(
            eq(mediaAssets.recordType, recordType),
            inArray(mediaAssets.recordId, ids),
          ),
        ),
      ),
    )
    .orderBy(...ORDER);
  for (const row of rows) {
    const key = mediaRecordKey(row.recordType, row.recordId);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

export function mediaRecordKey(recordType: string, recordId: string) {
  return `${recordType}:${recordId}`;
}
