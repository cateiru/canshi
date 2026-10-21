import { and, asc, eq, isNotNull, or, type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db/client";
import { catalogFoodProducts, foodProducts } from "@/db/schema";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { mediaUrl } from "@/features/media/view";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import { type CatalogSearchCriteria, toContainsPattern } from "./search";

/** 検索結果に表示する件数の上限 */
export const CATALOG_SEARCH_LIMIT = 50;

/** 部分一致。利用者の入力の `%`・`_` は `toContainsPattern` でエスケープ済み */
function contains(column: SQLiteColumn, value: string): SQL {
  return sql`${column} LIKE ${toContainsPattern(value)} ESCAPE '\\'`;
}

function searchConditions(criteria: CatalogSearchCriteria): SQL[] {
  const conditions: SQL[] = [];
  // キーワードは語ごとに、商品名かメーカー名のどちらかに含まれていればよい
  for (const keyword of criteria.keywords) {
    const condition = or(
      contains(catalogFoodProducts.name, keyword),
      contains(catalogFoodProducts.manufacturer, keyword),
    );
    if (condition) {
      conditions.push(condition);
    }
  }
  if (criteria.manufacturer) {
    conditions.push(
      contains(catalogFoodProducts.manufacturer, criteria.manufacturer),
    );
  }
  if (criteria.textureType) {
    conditions.push(eq(catalogFoodProducts.textureType, criteria.textureType));
  }
  if (criteria.nutritionType) {
    conditions.push(
      eq(catalogFoodProducts.nutritionType, criteria.nutritionType),
    );
  }
  if (criteria.lifeStage) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${catalogFoodProducts.lifeStages}) WHERE json_each.value = ${criteria.lifeStage})`,
    );
  }
  if (criteria.targetBreed) {
    conditions.push(eq(catalogFoodProducts.targetBreed, criteria.targetBreed));
  }
  return conditions;
}

/**
 * 共通のごはん商品を検索する。メーカー名・商品名の順に `CATALOG_SEARCH_LIMIT` 件まで返し、
 * それより多く見つかったときは `hasMore` を true にする。条件を指定しないときはすべてが対象。
 * AI との接続（MCP）は Durable Object の中で動くため、D1 は引数で受け取る
 */
export async function searchCatalogFoodProducts(
  criteria: CatalogSearchCriteria,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const rows = await db
    .select()
    .from(catalogFoodProducts)
    .where(and(...searchConditions(criteria)))
    // メーカー名が未入力の商品は後ろに並べる
    .orderBy(
      sql`${catalogFoodProducts.manufacturer} IS NULL`,
      asc(catalogFoodProducts.manufacturer),
      asc(catalogFoodProducts.name),
      asc(catalogFoodProducts.id),
    )
    .limit(CATALOG_SEARCH_LIMIT + 1);
  return {
    items: rows.slice(0, CATALOG_SEARCH_LIMIT),
    hasMore: rows.length > CATALOG_SEARCH_LIMIT,
  };
}

/** 家にすでに追加した共通のごはん商品の ID（ユーザーが家に所属していることは呼び出し元で確認する） */
export async function listAddedCatalogFoodProductIds(
  householdId: string,
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ id: foodProducts.catalogFoodProductId })
    .from(foodProducts)
    .where(
      and(
        eq(foodProducts.householdId, householdId),
        isNotNull(foodProducts.catalogFoodProductId),
      ),
    );
  return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
}

/**
 * 共通のごはん商品の ID → 画像の URL。画像のない商品は含まない。
 * 管理画面は縮小した画像だけを保存し、サムネイルを作らないため、元データの URL を返す
 */
export async function listCatalogFoodProductImageUrls(
  catalogFoodProductIds: string[],
): Promise<Record<string, string>> {
  const assetsByProduct = await listMediaAssetsByRecords(
    CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
    catalogFoodProductIds,
  );
  const urls: Record<string, string> = {};
  for (const [productId, assets] of assetsByProduct) {
    const image = assets[0];
    if (image) {
      urls[productId] = mediaUrl(image.id);
    }
  }
  return urls;
}
