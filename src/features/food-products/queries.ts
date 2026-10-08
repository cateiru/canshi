import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts, householdMembers } from "@/db/schema";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { mediaThumbnailUrl } from "@/features/media/view";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";

/**
 * 家のごはん商品の一覧。新しく登録した順（ユーザーが家に所属していることは呼び出し元で確認する）
 */
export async function listFoodProducts(householdId: string) {
  const db = getDb();
  return db
    .select()
    .from(foodProducts)
    .where(eq(foodProducts.householdId, householdId))
    .orderBy(desc(foodProducts.createdAt));
}

/**
 * ユーザーが所属する家のごはん商品の一覧。新しく登録した順。
 * 商品一覧・プリセットの登録画面で、家ごとにまとめて表示するために使う
 */
export async function listFoodProductsForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select({ foodProduct: foodProducts })
    .from(foodProducts)
    .innerJoin(
      householdMembers,
      eq(foodProducts.householdId, householdMembers.householdId),
    )
    .where(eq(householdMembers.userId, userId))
    .orderBy(desc(foodProducts.createdAt));
  return rows.map((row) => row.foodProduct);
}

/** ユーザーが所属する家のごはん商品であれば返す。存在しない・別の家の商品なら null */
export async function getFoodProductForUser(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ foodProduct: foodProducts })
    .from(foodProducts)
    .innerJoin(
      householdMembers,
      eq(foodProducts.householdId, householdMembers.householdId),
    )
    .where(and(eq(foodProducts.id, id), eq(householdMembers.userId, userId)))
    .limit(1);
  return row?.foodProduct ?? null;
}

/**
 * 指定した ID のうち、家のごはん商品だけを返す。ごはん記録・プリセットの明細に、
 * 別の家の商品を指定されていないかを確かめるために使う
 */
export async function listFoodProductsByIds(
  householdId: string,
  ids: string[],
) {
  if (ids.length === 0) {
    return [];
  }
  const db = getDb();
  return db
    .select()
    .from(foodProducts)
    .where(
      and(
        eq(foodProducts.householdId, householdId),
        inArray(foodProducts.id, ids),
      ),
    );
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
