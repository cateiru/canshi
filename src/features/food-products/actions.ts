"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/mutations";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { FOOD_PRODUCT_IN_USE_MESSAGE } from "./labels";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import { createFoodProduct, updateFoodProduct } from "./mutations";
import { getFoodProductForUser, listFoodProductUsages } from "./queries";
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
    manufacturer: formData.get("manufacturer"),
    kcalPer100g: formData.get("kcalPer100g"),
    packageAmountG: formData.get("packageAmountG"),
    packageUnit: formData.get("packageUnit"),
    nutritionType: formData.get("nutritionType"),
    textureType: formData.get("textureType"),
    lifeStages: formData.getAll("lifeStages"),
    targetBreed: formData.get("targetBreed"),
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

  const id = await createFoodProduct(user.id, householdId, parsed.data);
  if (!id) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }

  const mediaError = await syncRecordMediaFromForm(
    FOOD_PRODUCT_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
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

  if (!(await updateFoodProduct(user.id, id, parsed.data))) {
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

  // ごはん記録から参照されている商品は ON DELETE 制約でこのまま削除すると失敗し、プリセットから
  // 参照されている商品を削除するとプリセットに壊れた参照（存在しない商品 ID）が残るため、
  // どちらかに使われている場合は削除せずにエラーを返す。一覧でも削除できないことを先に表示しているが、
  // 一覧を開いた後に記録・プリセットで使われた場合に備えて、ここでも確かめる
  const usage = (await listFoodProductUsages([id])).get(id);
  if (usage) {
    return { error: FOOD_PRODUCT_IN_USE_MESSAGE[usage] };
  }

  // 商品画像（R2 のオブジェクトと media_assets 行）を先に削除する。ほかの記録の削除と同じく、
  // R2 の削除に失敗したときは例外で止まり商品が残るため、もう一度削除し直せる（商品を先に削除すると、
  // 画像の削除に失敗したときに商品がなくなり、残った画像を誰も削除できなくなる）。
  // 引き換えに、画像の削除から下の商品の削除までの間に家から外された場合は、画像だけが消えて
  // 商品が残る。R2 の削除は D1 のトランザクションに含められないため、孤立した画像を作らないことを
  // 優先した（`syncRecordMedia` と同じく、PR #257 のレビューで見送った）
  await deleteMediaAssetsByRecord(FOOD_PRODUCT_MEDIA_TYPE, id);
  const db = getDb();
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
