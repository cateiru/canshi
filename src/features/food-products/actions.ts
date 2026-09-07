"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { feedingRecords, foodProducts } from "@/db/schema";
import {
  type FoodProductFormFieldErrors,
  foodProductFormSchema,
} from "./schema";

export type FoodProductFormState = {
  fieldErrors?: FoodProductFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return foodProductFormSchema.safeParse({
    name: formData.get("name"),
    kcalPer100g: formData.get("kcalPer100g"),
    packageAmountG: formData.get("packageAmountG"),
    nutritionType: formData.get("nutritionType"),
    textureType: formData.get("textureType"),
  });
}

export async function createFoodProductAction(
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(foodProducts).values(parsed.data);

  redirect("/food-products");
}

export async function updateFoodProductAction(
  id: string,
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(foodProducts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(foodProducts.id, id))
    .returning({ id: foodProducts.id });

  if (result.length === 0) {
    return { formError: "商品が見つかりませんでした" };
  }

  redirect("/food-products");
}

export type DeleteFoodProductResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFoodProductAction(
  id: string,
): Promise<DeleteFoodProductResult> {
  const db = getDb();
  // food_product_id は ON DELETE 制約でこのまま削除すると失敗するため、
  // 給餌記録から参照されている場合は削除せずにエラーを返す
  const [inUse] = await db
    .select({ id: feedingRecords.id })
    .from(feedingRecords)
    .where(eq(feedingRecords.foodProductId, id))
    .limit(1);

  if (inUse) {
    return { error: "この商品を使った給餌記録があるため削除できません" };
  }

  await db.delete(foodProducts).where(eq(foodProducts.id, id));
  return {};
}
