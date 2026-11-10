import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  type FeedingMode,
  type FeedingRecord,
  type FeedingRecordItem,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  type GivenAmountLevel,
  type LeftoverLevel,
} from "@/db/schema";

export type FeedingRecordItemWithProduct = {
  id: string;
  foodProductId: string;
  foodProductName: string;
  /** グラム単位の量・推定値。あいまいモードの記録では null */
  givenAmountG: number | null;
  leftoverAmountG: number | null;
  estimatedIntakeG: number | null;
  estimatedKcal: number | null;
  /** 段階での量。厳格モードの記録では null */
  givenAmountLevel: GivenAmountLevel | null;
  leftoverLevel: LeftoverLevel | null;
};

export type FeedingRecordWithItems = {
  id: string;
  catId: string;
  occurredAt: Date;
  mode: FeedingMode;
  memo: string | null;
  items: FeedingRecordItemWithProduct[];
};

async function attachItems(
  headers: Omit<FeedingRecordWithItems, "items">[],
): Promise<FeedingRecordWithItems[]> {
  if (headers.length === 0) {
    return [];
  }

  const db = getDb();
  // 一覧では猫の記録をすべて渡すため、記録の ID を D1 のバインドパラメーターの上限内に分割して引く。
  // 1 つの記録の明細は同じチャンクに収まるので、記録ごとの sortOrder の並びは保たれる
  const itemRows = [];
  for (const ids of chunkForBoundParameters(
    headers.map((header) => header.id),
  )) {
    const rows = await db
      .select({
        id: feedingRecordItems.id,
        feedingRecordId: feedingRecordItems.feedingRecordId,
        foodProductId: feedingRecordItems.foodProductId,
        foodProductName: foodProducts.name,
        givenAmountG: feedingRecordItems.givenAmountG,
        leftoverAmountG: feedingRecordItems.leftoverAmountG,
        estimatedIntakeG: feedingRecordItems.estimatedIntakeG,
        estimatedKcal: feedingRecordItems.estimatedKcal,
        givenAmountLevel: feedingRecordItems.givenAmountLevel,
        leftoverLevel: feedingRecordItems.leftoverLevel,
        sortOrder: feedingRecordItems.sortOrder,
      })
      .from(feedingRecordItems)
      .innerJoin(
        foodProducts,
        eq(feedingRecordItems.foodProductId, foodProducts.id),
      )
      .where(inArray(feedingRecordItems.feedingRecordId, ids))
      .orderBy(feedingRecordItems.sortOrder);
    itemRows.push(...rows);
  }

  const itemsByRecordId = new Map<string, FeedingRecordItemWithProduct[]>();
  for (const row of itemRows) {
    const list = itemsByRecordId.get(row.feedingRecordId) ?? [];
    list.push({
      id: row.id,
      foodProductId: row.foodProductId,
      foodProductName: row.foodProductName,
      givenAmountG: row.givenAmountG,
      leftoverAmountG: row.leftoverAmountG,
      estimatedIntakeG: row.estimatedIntakeG,
      estimatedKcal: row.estimatedKcal,
      givenAmountLevel: row.givenAmountLevel,
      leftoverLevel: row.leftoverLevel,
    });
    itemsByRecordId.set(row.feedingRecordId, list);
  }

  return headers.map((header) => ({
    ...header,
    items: itemsByRecordId.get(header.id) ?? [],
  }));
}

export async function listFeedingRecords(
  catId: string,
): Promise<FeedingRecordWithItems[]> {
  const db = getDb();
  const headers = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
      mode: feedingRecords.mode,
      memo: feedingRecords.memo,
    })
    .from(feedingRecords)
    .where(
      and(eq(feedingRecords.catId, catId), isNull(feedingRecords.deletedAt)),
    )
    .orderBy(desc(feedingRecords.occurredAt));

  return attachItems(headers);
}

export async function getFeedingRecordById(
  id: string,
): Promise<FeedingRecordWithItems | null> {
  const db = getDb();
  const [header] = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
      mode: feedingRecords.mode,
      memo: feedingRecords.memo,
    })
    .from(feedingRecords)
    .where(and(eq(feedingRecords.id, id), isNull(feedingRecords.deletedAt)))
    .limit(1);

  if (!header) {
    return null;
  }

  const [withItems] = await attachItems([header]);
  return withItems;
}

/**
 * 記録フォームの初期選択に使うため、直近使用した商品の ID を新しい順・重複なしで返す。
 */
/**
 * 猫に最近与えた商品の ID。記録フォームの選択肢と揃えるため、猫の家の商品に限る
 */
export async function listRecentlyUsedFoodProductIds(
  catId: string,
  householdId: string,
  limit = 5,
) {
  const db = getDb();
  // 直近の生レコードが同一商品に偏っていても limit 件のユニークIDを拾える
  // よう、スキャン件数を limit に比例させる（最低20件は見る）
  const rows = await db
    .select({ foodProductId: feedingRecordItems.foodProductId })
    .from(feedingRecordItems)
    .innerJoin(
      feedingRecords,
      eq(feedingRecordItems.feedingRecordId, feedingRecords.id),
    )
    .innerJoin(
      foodProducts,
      eq(feedingRecordItems.foodProductId, foodProducts.id),
    )
    .where(
      and(
        eq(feedingRecords.catId, catId),
        isNull(feedingRecords.deletedAt),
        eq(foodProducts.householdId, householdId),
      ),
    )
    .orderBy(desc(feedingRecords.occurredAt))
    .limit(Math.max(limit * 10, 20));

  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.foodProductId);
    if (seen.size >= limit) {
      break;
    }
  }
  return Array.from(seen);
}

/** 猫のごはんの記録（明細を含まない行）を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getFeedingRecordRowForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<FeedingRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(feedingRecords)
    .where(
      and(
        eq(feedingRecords.id, id),
        eq(feedingRecords.catId, catId),
        isNull(feedingRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}

/** ごはんの記録の明細（商品名・画像を含まない行）。並び順のとおり */
export async function listFeedingRecordItemRows(
  feedingRecordId: string,
  d1?: D1Database,
): Promise<FeedingRecordItem[]> {
  return getDb(d1)
    .select()
    .from(feedingRecordItems)
    .where(eq(feedingRecordItems.feedingRecordId, feedingRecordId))
    .orderBy(asc(feedingRecordItems.sortOrder));
}
