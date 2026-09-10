import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts } from "@/db/schema";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { mediaThumbnailUrl } from "@/features/media/view";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";

export async function listFoodProducts() {
  const db = getDb();
  return db.select().from(foodProducts).orderBy(desc(foodProducts.createdAt));
}

export async function getFoodProductById(id: string) {
  const db = getDb();
  const [foodProduct] = await db
    .select()
    .from(foodProducts)
    .where(eq(foodProducts.id, id))
    .limit(1);
  return foodProduct ?? null;
}

/**
 * 商品 ID → 商品画像（サムネイル）の URL。画像のない商品は含まない。
 * ごはん記録フォーム・プリセットなど、商品を画像で識別したい画面に渡す
 */
export async function listFoodProductImageUrls(
  productIds: string[],
): Promise<Record<string, string>> {
  const assetsByProduct = await listMediaAssetsByRecords(
    FOOD_PRODUCT_MEDIA_TYPE,
    productIds,
  );
  const urls: Record<string, string> = {};
  for (const [productId, assets] of assetsByProduct) {
    const image = assets[0];
    if (image) {
      urls[productId] = mediaThumbnailUrl(image.id);
    }
  }
  return urls;
}
