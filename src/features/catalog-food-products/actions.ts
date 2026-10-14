"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  catalogFoodProducts,
  foodProducts,
  householdMembers,
} from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/media";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { readMediaObject, storeMediaAsset } from "@/features/media/storage";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "./media";

export type AddCatalogFoodProductState = { error?: string };

/**
 * 共通のごはん商品の画像を、家に追加した商品の画像として保存し直す。家の商品の画像は家ごとに
 * 差し替え・削除できるため、R2 のオブジェクトを共有せず、通常のアップロードと同じ経路
 * （メタデータの除去・サムネイルの作成・保存容量の確認）で別のオブジェクトにする
 */
async function copyCatalogImage(
  catalogFoodProductId: string,
  foodProductId: string,
) {
  const [image] = await listMediaAssetsByRecord(
    CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
    catalogFoodProductId,
  );
  if (!image) {
    return;
  }
  const file = await readMediaObject(image.objectKey);
  if (!file) {
    return;
  }
  await storeMediaAsset({
    recordType: FOOD_PRODUCT_MEDIA_TYPE,
    recordId: foodProductId,
    catId: null,
    file,
  });
}

/**
 * 共通のごはん商品を、フォームの `householdId` の家のごはん商品として追加する。内容を写して
 * 新しい商品を作るため、追加した後は手動で登録した商品と同じく自由に編集できる。
 * 追加できたら家のごはん商品一覧へ移動する（`returnToHousehold` があればその家の一覧）
 */
export async function addCatalogFoodProductAction(
  catalogFoodProductId: string,
  _prevState: AddCatalogFoodProductState,
  formData: FormData,
): Promise<AddCatalogFoodProductState> {
  const user = await requireUser();
  const householdId = readFormHouseholdId(formData);
  if (!householdId) {
    return { error: "追加先の家を選び直してください" };
  }

  const db = getDb();
  // 判定と追加の間に家から外された場合に追加が通らないよう、INSERT ... SELECT で
  // 追加先の家のメンバーの行と共通のごはん商品があるときだけ 1 文で挿入する
  // （`createFoodProductAction` と同じ）。INSERT ... SELECT では列の既定値が使われないため
  // ID はここで作り、列はテーブル定義と同じ並びにする
  const [created] = await db
    .insert(foodProducts)
    .select((qb) =>
      qb
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          householdId: householdMembers.householdId,
          name: catalogFoodProducts.name,
          manufacturer: catalogFoodProducts.manufacturer,
          kcalPer100g: catalogFoodProducts.kcalPer100g,
          packageAmountG: catalogFoodProducts.packageAmountG,
          packageUnit: catalogFoodProducts.packageUnit,
          nutritionType: catalogFoodProducts.nutritionType,
          textureType: catalogFoodProducts.textureType,
          lifeStages: catalogFoodProducts.lifeStages,
          targetBreed: catalogFoodProducts.targetBreed,
          catalogFoodProductId: catalogFoodProducts.id,
          createdAt: sql`(unixepoch())`.as("created_at"),
          updatedAt: sql`(unixepoch())`.as("updated_at"),
        })
        .from(catalogFoodProducts)
        .innerJoin(
          householdMembers,
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, user.id),
          ),
        )
        .where(eq(catalogFoodProducts.id, catalogFoodProductId)),
    )
    .returning({ id: foodProducts.id });
  if (!created) {
    return {
      error:
        "追加できませんでした。商品が削除されたか、選んだ家に所属していない可能性があります",
    };
  }

  try {
    await copyCatalogImage(catalogFoodProductId, created.id);
  } catch (error) {
    // 画像を保存できなくても（保存容量の上限など）、商品は追加したままにする。
    // 画像は追加した後に商品の編集から登録し直せる
    console.error("共通のごはん商品の画像を保存できませんでした", error);
  }

  redirect(
    formData.get("returnToHousehold")
      ? `/food-products?householdId=${encodeURIComponent(householdId)}`
      : "/food-products",
  );
}
