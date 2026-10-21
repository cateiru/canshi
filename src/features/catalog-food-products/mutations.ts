import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProducts } from "@/db/schema";
import type { CatalogFoodProductInput } from "./schema";

/*
 * 共通のごはん商品の保存。AI との接続（MCP）から使う（管理画面は `packages/admin` で別に書く）。
 * admin のユーザーであることは呼び出し元で確かめる。MCP は Durable Object の中で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 列に書く値。管理画面と同じく、`package_amount_g`・`package_unit` には先頭の候補を、
 * `package_sizes` には先頭を含むすべての候補を書く（`catalogPackageSizes` 参照）
 */
function toColumns(values: CatalogFoodProductInput) {
  const [first] = values.packageSizes;
  return {
    name: values.name,
    manufacturer: values.manufacturer,
    kcalPer100g: values.kcalPer100g,
    packageAmountG: first.amountG,
    packageUnit: first.unit,
    packageSizes: values.packageSizes,
    nutritionType: values.nutritionType,
    textureType: values.textureType,
    lifeStages: values.lifeStages,
    targetBreed: values.targetBreed,
  };
}

/** 共通のごはん商品を登録し、ID を返す */
export async function createCatalogFoodProduct(
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(catalogFoodProducts)
    .values(toColumns(values))
    .returning({ id: catalogFoodProducts.id });
  return created.id;
}

/**
 * 共通のごはん商品を更新する。家に追加済みのごはん商品は内容を写したものなので、変更は
 * 反映されない。商品がなければ false
 */
export async function updateCatalogFoodProduct(
  id: string,
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<boolean> {
  const updated = await getDb(d1)
    .update(catalogFoodProducts)
    .set({ ...toColumns(values), updatedAt: new Date() })
    .where(eq(catalogFoodProducts.id, id))
    .returning({ id: catalogFoodProducts.id });
  return updated.length > 0;
}
