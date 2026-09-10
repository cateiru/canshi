import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedingPresetItems, feedingPresets, foodProducts } from "@/db/schema";
import { listFoodProductImageUrls } from "@/features/food-products/queries";

export type FeedingPresetItemWithProduct = {
  id: string;
  foodProductId: string;
  foodProductName: string;
  /** 商品画像（サムネイル）の URL。未登録なら null */
  foodProductImageUrl: string | null;
  givenAmountG: number;
};

export type FeedingPresetWithItems = {
  id: string;
  name: string;
  items: FeedingPresetItemWithProduct[];
};

async function attachItems(
  presets: { id: string; name: string }[],
): Promise<FeedingPresetWithItems[]> {
  if (presets.length === 0) {
    return [];
  }

  const db = getDb();
  const itemRows = await db
    .select({
      id: feedingPresetItems.id,
      presetId: feedingPresetItems.presetId,
      foodProductId: feedingPresetItems.foodProductId,
      foodProductName: foodProducts.name,
      givenAmountG: feedingPresetItems.givenAmountG,
      sortOrder: feedingPresetItems.sortOrder,
    })
    .from(feedingPresetItems)
    .innerJoin(
      foodProducts,
      eq(feedingPresetItems.foodProductId, foodProducts.id),
    )
    .where(
      inArray(
        feedingPresetItems.presetId,
        presets.map((preset) => preset.id),
      ),
    )
    .orderBy(feedingPresetItems.sortOrder);

  const imageUrls = await listFoodProductImageUrls([
    ...new Set(itemRows.map((row) => row.foodProductId)),
  ]);

  const itemsByPresetId = new Map<string, FeedingPresetItemWithProduct[]>();
  for (const row of itemRows) {
    const list = itemsByPresetId.get(row.presetId) ?? [];
    list.push({
      id: row.id,
      foodProductId: row.foodProductId,
      foodProductName: row.foodProductName,
      foodProductImageUrl: imageUrls[row.foodProductId] ?? null,
      givenAmountG: row.givenAmountG,
    });
    itemsByPresetId.set(row.presetId, list);
  }

  return presets.map((preset) => ({
    ...preset,
    items: itemsByPresetId.get(preset.id) ?? [],
  }));
}

export async function listFeedingPresets(): Promise<FeedingPresetWithItems[]> {
  const db = getDb();
  const presets = await db
    .select({ id: feedingPresets.id, name: feedingPresets.name })
    .from(feedingPresets)
    .orderBy(desc(feedingPresets.createdAt));

  return attachItems(presets);
}

export async function getFeedingPresetById(
  id: string,
): Promise<FeedingPresetWithItems | null> {
  const db = getDb();
  const [preset] = await db
    .select({ id: feedingPresets.id, name: feedingPresets.name })
    .from(feedingPresets)
    .where(eq(feedingPresets.id, id))
    .limit(1);

  if (!preset) {
    return null;
  }

  const [withItems] = await attachItems([preset]);
  return withItems;
}
