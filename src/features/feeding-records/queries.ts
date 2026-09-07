import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedingRecordItems, feedingRecords, foodProducts } from "@/db/schema";

export type FeedingRecordItemWithProduct = {
  id: string;
  foodProductId: string;
  foodProductName: string;
  givenAmountG: number;
  leftoverAmountG: number;
  estimatedIntakeG: number;
  estimatedKcal: number;
};

export type FeedingRecordWithItems = {
  id: string;
  catId: string;
  occurredAt: Date;
  items: FeedingRecordItemWithProduct[];
};

async function attachItems(
  headers: { id: string; catId: string; occurredAt: Date }[],
): Promise<FeedingRecordWithItems[]> {
  if (headers.length === 0) {
    return [];
  }

  const db = getDb();
  const itemRows = await db
    .select({
      id: feedingRecordItems.id,
      feedingRecordId: feedingRecordItems.feedingRecordId,
      foodProductId: feedingRecordItems.foodProductId,
      foodProductName: foodProducts.name,
      givenAmountG: feedingRecordItems.givenAmountG,
      leftoverAmountG: feedingRecordItems.leftoverAmountG,
      estimatedIntakeG: feedingRecordItems.estimatedIntakeG,
      estimatedKcal: feedingRecordItems.estimatedKcal,
      sortOrder: feedingRecordItems.sortOrder,
    })
    .from(feedingRecordItems)
    .innerJoin(
      foodProducts,
      eq(feedingRecordItems.foodProductId, foodProducts.id),
    )
    .where(
      inArray(
        feedingRecordItems.feedingRecordId,
        headers.map((header) => header.id),
      ),
    )
    .orderBy(feedingRecordItems.sortOrder);

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
    })
    .from(feedingRecords)
    .where(eq(feedingRecords.catId, catId))
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
    })
    .from(feedingRecords)
    .where(eq(feedingRecords.id, id))
    .limit(1);

  if (!header) {
    return null;
  }

  const [withItems] = await attachItems([header]);
  return withItems;
}

/**
 * ワンタップ入力のクイック選択用に、直近使用した商品の ID を新しい順・重複なしで返す。
 */
export async function listRecentlyUsedFoodProductIds(catId: string, limit = 5) {
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
    .where(eq(feedingRecords.catId, catId))
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
