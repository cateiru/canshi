import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts, householdMembers } from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import type { FoodProductFormInput } from "./schema";

/*
 * ごはん商品の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 家のメンバーであることは文の中で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 家の商品を追加し、その ID を返す。ユーザーが家のメンバーでなければ追加せずに null。
 *
 * 商品は登録時に選んだ家に属する。登録後に家は変えられない（ほかの家のプリセット・
 * ごはん記録から参照されないようにするため）
 */
export async function createFoodProduct(
  userId: string,
  householdId: string,
  values: FoodProductFormInput,
  d1?: D1Database,
): Promise<string | null> {
  // 判定と登録の間に家から外された場合に登録が通らないよう、INSERT ... SELECT で
  // 登録先の家のメンバーの行があるときだけ 1 文で挿入する（`createCatForUser` と同じ）。
  // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
  const [created] = await getDb(d1)
    .insert(foodProducts)
    .select((qb) =>
      qb
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          householdId: householdMembers.householdId,
          name: sql`${values.name}`.as("name"),
          manufacturer: sql`${values.manufacturer}`.as("manufacturer"),
          kcalPer100g: sql`${values.kcalPer100g}`.as("kcal_per_100g"),
          packageAmountG: sql`${values.packageAmountG}`.as("package_amount_g"),
          packageUnit: sql`${values.packageUnit}`.as("package_unit"),
          nutritionType: sql`${values.nutritionType}`.as("nutrition_type"),
          textureType: sql`${values.textureType}`.as("texture_type"),
          // sql`` には列の型変換がかからないため、JSON 列は文字列にして渡す
          lifeStages: sql`${JSON.stringify(values.lifeStages)}`.as(
            "life_stages",
          ),
          targetBreed: sql`${values.targetBreed}`.as("target_breed"),
          // 手動で登録した商品は、共通のごはん商品の追加元を持たない
          catalogFoodProductId: sql`NULL`.as("catalog_food_product_id"),
          createdAt: sql`(unixepoch())`.as("created_at"),
          updatedAt: sql`(unixepoch())`.as("updated_at"),
        })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, userId),
          ),
        ),
    )
    .returning({ id: foodProducts.id });
  return created?.id ?? null;
}

/**
 * ユーザーが所属する家の商品を更新する。別の家の商品は、存在しない商品と区別せずに false。
 * 判定と更新の間に家から外された場合に更新が通らないよう、所属の確認は UPDATE の WHERE に含める
 */
export async function updateFoodProduct(
  userId: string,
  id: string,
  values: FoodProductFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const db = getDb(d1);
  const updated = await db
    .update(foodProducts)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(foodProducts.id, id),
        isHouseholdMemberCondition(foodProducts.householdId, userId),
      ),
    )
    .returning({ id: foodProducts.id });
  return updated.length > 0;
}
