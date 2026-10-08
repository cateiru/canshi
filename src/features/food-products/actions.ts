"use server";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedingPresetItems,
  feedingRecordItems,
  foodProducts,
  householdMembers,
} from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/mutations";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import { getFoodProductForUser } from "./queries";
import {
  type FoodProductFormFieldErrors,
  foodProductFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。商品画像はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type FoodProductFormState = MediaFormState & {
  fieldErrors?: FoodProductFormFieldErrors & { householdId?: string[] };
};

function parseFormData(formData: FormData) {
  return foodProductFormSchema.safeParse({
    name: formData.get("name"),
    kcalPer100g: formData.get("kcalPer100g"),
    packageAmountG: formData.get("packageAmountG"),
    packageUnit: formData.get("packageUnit"),
    nutritionType: formData.get("nutritionType"),
    textureType: formData.get("textureType"),
  });
}

export async function createFoodProductAction(
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 商品は登録時に選んだ家に属する。登録後に家は変えられない（ほかの家のプリセット・
  // ごはん記録から参照されないようにするため）
  const householdId = readFormHouseholdId(formData);
  if (!householdId) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }

  const db = getDb();
  const values = parsed.data;
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
          name: sql`${values.name}`.as("name"),
          kcalPer100g: sql`${values.kcalPer100g}`.as("kcal_per_100g"),
          packageAmountG: sql`${values.packageAmountG}`.as("package_amount_g"),
          packageUnit: sql`${values.packageUnit}`.as("package_unit"),
          nutritionType: sql`${values.nutritionType}`.as("nutrition_type"),
          textureType: sql`${values.textureType}`.as("texture_type"),
          createdAt: sql`(unixepoch())`.as("created_at"),
          updatedAt: sql`(unixepoch())`.as("updated_at"),
        })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, user.id),
          ),
        ),
    )
    .returning({ id: foodProducts.id });
  if (!created) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }

  const mediaError = await syncRecordMediaFromForm(
    FOOD_PRODUCT_MEDIA_TYPE,
    created.id,
    formData,
  );
  return { savedRecordId: created.id, formError: mediaError };
}

export async function updateFoodProductAction(
  id: string,
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 別の家の商品は、存在しない商品と区別せずに扱う。判定と更新の間に家から外された場合に
  // 更新が通らないよう、所属の確認は UPDATE の WHERE に含める
  const db = getDb();
  const updated = await db
    .update(foodProducts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(foodProducts.id, id),
        isHouseholdMemberCondition(foodProducts.householdId, user.id),
      ),
    )
    .returning({ id: foodProducts.id });
  if (updated.length === 0) {
    return { formError: "商品が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    FOOD_PRODUCT_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export type DeleteFoodProductResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFoodProductAction(
  id: string,
): Promise<DeleteFoodProductResult> {
  const user = await requireUser();
  const foodProduct = await getFoodProductForUser(user.id, id);
  if (!foodProduct) {
    return { error: "商品が見つかりませんでした" };
  }

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

  // 商品画像（R2 のオブジェクトと media_assets 行）を先に削除する。ほかの記録の削除と同じく、
  // R2 の削除に失敗したときは例外で止まり商品が残るため、もう一度削除し直せる（商品を先に削除すると、
  // 画像の削除に失敗したときに商品がなくなり、残った画像を誰も削除できなくなる）
  await deleteMediaAssetsByRecord(FOOD_PRODUCT_MEDIA_TYPE, id);
  // 最初の確認の後に家から外された場合に削除が通らないよう、所属の確認は DELETE の WHERE にも含める
  const deleted = await db
    .delete(foodProducts)
    .where(
      and(
        eq(foodProducts.id, id),
        isHouseholdMemberCondition(foodProducts.householdId, user.id),
      ),
    )
    .returning({ id: foodProducts.id });
  if (deleted.length === 0) {
    return { error: "商品が見つかりませんでした" };
  }
  return {};
}
