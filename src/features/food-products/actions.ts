"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedingPresetItems,
  feedingRecordItems,
  foodProducts,
} from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import {
  type FoodProductFormFieldErrors,
  foodProductFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。商品画像のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type FoodProductFormState = MediaFormState & {
  fieldErrors?: FoodProductFormFieldErrors;
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
  const [created] = await db
    .insert(foodProducts)
    .values(parsed.data)
    .returning({ id: foodProducts.id });

  return { savedRecordId: created.id };
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

  return { savedRecordId: id };
}

export type DeleteFoodProductResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFoodProductAction(
  id: string,
): Promise<DeleteFoodProductResult> {
  const db = getDb();
  // food_product_id は ON DELETE 制約でこのまま削除すると失敗するため、
  // ごはん記録から参照されている場合は削除せずにエラーを返す
  const [inUse] = await db
    .select({ id: feedingRecordItems.id })
    .from(feedingRecordItems)
    .where(eq(feedingRecordItems.foodProductId, id))
    .limit(1);

  if (inUse) {
    return { error: "この商品を使ったごはん記録があるため削除できません" };
  }

  // プリセットから参照されている商品を削除すると、プリセットに壊れた参照
  // （存在しない商品 ID）が残ってしまうため、こちらも同様にガードする
  const [inUseByPreset] = await db
    .select({ id: feedingPresetItems.id })
    .from(feedingPresetItems)
    .where(eq(feedingPresetItems.foodProductId, id))
    .limit(1);

  if (inUseByPreset) {
    return {
      error: "この商品を使ったプリセットがあるため削除できません",
    };
  }

  // 商品画像（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(FOOD_PRODUCT_MEDIA_TYPE, id);
  await db.delete(foodProducts).where(eq(foodProducts.id, id));
  return {};
}
