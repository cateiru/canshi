import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts, householdMembers } from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/infrastructure/queries";
import type { FoodProductRepository } from "../domain/foodProductRepository";

/** D1 に保存する `FoodProductRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createFoodProductRepository(
  d1?: D1Database,
): FoodProductRepository {
  const db = getDb(d1);
  const ofMember = (userId: string, id: string) =>
    and(
      eq(foodProducts.id, id),
      isHouseholdMemberCondition(foodProducts.householdId, userId),
    );

  return {
    async addForMember(userId, householdId, content) {
      // 判定と登録の間に家から外された場合に登録が通らないよう、INSERT ... SELECT で
      // 登録先の家のメンバーの行があるときだけ 1 文で挿入する（`createCatForUser` と同じ）。
      // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
      const [created] = await db
        .insert(foodProducts)
        .select((qb) =>
          qb
            .select({
              id: sql`${crypto.randomUUID()}`.as("id"),
              householdId: householdMembers.householdId,
              name: sql`${content.name}`.as("name"),
              manufacturer: sql`${content.manufacturer}`.as("manufacturer"),
              kcalPer100g: sql`${content.kcalPer100g}`.as("kcal_per_100g"),
              packageAmountG: sql`${content.packageAmountG}`.as(
                "package_amount_g",
              ),
              packageUnit: sql`${content.packageUnit}`.as("package_unit"),
              nutritionType: sql`${content.nutritionType}`.as("nutrition_type"),
              textureType: sql`${content.textureType}`.as("texture_type"),
              // sql`` には列の型変換がかからないため、JSON 列は文字列にして渡す
              lifeStages: sql`${JSON.stringify(content.lifeStages)}`.as(
                "life_stages",
              ),
              targetBreed: sql`${content.targetBreed}`.as("target_breed"),
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
    },

    async updateForMember(userId, id, content) {
      const updated = await db
        .update(foodProducts)
        .set({ ...content, updatedAt: new Date() })
        .where(ofMember(userId, id))
        .returning({ id: foodProducts.id });
      return updated.length > 0;
    },

    async removeForMember(userId, id) {
      const deleted = await db
        .delete(foodProducts)
        .where(ofMember(userId, id))
        .returning({ id: foodProducts.id });
      return deleted.length > 0;
    },
  };
}
