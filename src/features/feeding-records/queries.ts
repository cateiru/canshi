import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedingRecords, foodProducts } from "@/db/schema";

export async function listFeedingRecords(catId: string) {
  const db = getDb();
  return db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      foodProductId: feedingRecords.foodProductId,
      foodProductName: foodProducts.name,
      occurredAt: feedingRecords.occurredAt,
      givenAmountG: feedingRecords.givenAmountG,
      leftoverAmountG: feedingRecords.leftoverAmountG,
      estimatedIntakeG: feedingRecords.estimatedIntakeG,
      estimatedKcal: feedingRecords.estimatedKcal,
    })
    .from(feedingRecords)
    .innerJoin(foodProducts, eq(feedingRecords.foodProductId, foodProducts.id))
    .where(eq(feedingRecords.catId, catId))
    .orderBy(desc(feedingRecords.occurredAt));
}

export async function getFeedingRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(feedingRecords)
    .where(eq(feedingRecords.id, id))
    .limit(1);
  return record ?? null;
}

/**
 * ワンタップ入力のクイック選択用に、直近使用した商品の ID を新しい順・重複なしで返す。
 */
export async function listRecentlyUsedFoodProductIds(catId: string, limit = 5) {
  const db = getDb();
  // 直近の生レコードが同一商品に偏っていても limit 件のユニークIDを拾える
  // よう、スキャン件数を limit に比例させる（最低20件は見る）
  const rows = await db
    .select({ foodProductId: feedingRecords.foodProductId })
    .from(feedingRecords)
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
