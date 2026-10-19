"use server";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  catalogFoodProducts,
  foodProducts,
  householdMembers,
} from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/media";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { getHouseholdForUser } from "@/features/households/queries";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { readMediaObject, storeMediaAsset } from "@/features/media/storage";
import type { SubmitRedirect } from "@/features/navigation/types";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import { parsePackageSizeValue } from "./packageSizes";
import { listAddedCatalogFoodProductIds } from "./queries";

/**
 * 追加できたら（追加済みのときも）`redirectTo` に家のごはん商品一覧を返し、クライアント
 * （`useSubmitActionState`）が遷移する。サーバーでリダイレクトすると履歴が積み増され、
 * 一覧から戻ると検索ページに戻ってしまうため、送信後の遷移はほかのフォームと揃える
 */
export type AddCatalogFoodProductState = SubmitRedirect & { error?: string };

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
 * 内容量はフォームの `packageSize`（`toPackageSizeValue`）で選んだ候補にする。
 * 同じ家にはすでに追加した商品を重ねて追加しない（別の内容量を選んでも追加しない）。
 * 追加できたら（追加済みのときも）家のごはん商品一覧（`returnToHousehold` があればその家の一覧）を
 * `redirectTo` で返す
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
  const packageSize = parsePackageSizeValue(formData.get("packageSize"));
  if (!packageSize) {
    return { error: "内容量を選び直してください" };
  }

  const db = getDb();
  // 判定と追加の間に家から外された場合に追加が通らないよう、INSERT ... SELECT で
  // 追加先の家のメンバーの行と共通のごはん商品があるときだけ 1 文で挿入する
  // （`createFoodProductAction` と同じ）。INSERT ... SELECT では列の既定値が使われないため
  // ID はここで作り、列はテーブル定義と同じ並びにする。
  // 選んだ内容量も、その時点の候補にあるときだけ挿入する（画面を開いてから管理画面で候補が
  // 変わったときに、候補にない内容量を追加しない）。
  // 同じ家に同じ共通のごはん商品は 1 件だけにする（一意インデックス）。古い画面から送られたり、
  // 同時に追加されたりしたときは挿入せず、下で追加済みとして扱う
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
          packageAmountG: sql`${packageSize.amountG}`.as("package_amount_g"),
          packageUnit: sql`${packageSize.unit}`.as("package_unit"),
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
        .where(
          and(
            eq(catalogFoodProducts.id, catalogFoodProductId),
            // 候補が空の商品は、候補を追加する前の内容量を唯一の候補とする（`catalogPackageSizes`）
            sql`(EXISTS (
              SELECT 1 FROM json_each(${catalogFoodProducts.packageSizes})
              WHERE json_extract(json_each.value, '$.amountG') = ${packageSize.amountG}
                AND json_extract(json_each.value, '$.unit') IS ${packageSize.unit}
            ) OR (
              json_array_length(${catalogFoodProducts.packageSizes}) = 0
              AND ${catalogFoodProducts.packageAmountG} = ${packageSize.amountG}
              AND ${catalogFoodProducts.packageUnit} IS ${packageSize.unit}
            ))`,
          ),
        ),
    )
    .onConflictDoNothing()
    .returning({ id: foodProducts.id });
  const returnTo = formData.get("returnToHousehold")
    ? `/food-products?householdId=${encodeURIComponent(householdId)}`
    : "/food-products";
  if (!created) {
    if (await getHouseholdForUser(user.id, householdId)) {
      // すでに追加済みなら、追加できたときと同じく一覧へ移動する（画像も追加済みのものを使う）
      if (
        (await listAddedCatalogFoodProductIds(householdId)).has(
          catalogFoodProductId,
        )
      ) {
        return { redirectTo: returnTo };
      }
      // 家に所属していて商品もあるなら、選んだ内容量が候補になかった
      const [catalogFoodProduct] = await db
        .select({ id: catalogFoodProducts.id })
        .from(catalogFoodProducts)
        .where(eq(catalogFoodProducts.id, catalogFoodProductId))
        .limit(1);
      if (catalogFoodProduct) {
        return {
          error:
            "選んだ内容量は候補から外れました。ページを読み込み直して選び直してください",
        };
      }
    }
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

  return { redirectTo: returnTo };
}
