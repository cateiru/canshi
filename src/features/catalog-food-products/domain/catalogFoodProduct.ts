import type { CatalogFoodProduct } from "@/db/schema";
import type { CatalogFoodProductInput } from "./schema";

/**
 * 共通のごはん商品（エンティティ）。どの家にも属さず、admin のユーザーが管理する。
 * 家に追加すると内容を写した家のごはん商品ができ、その後の変更は反映されない
 */
export type { CatalogFoodProduct };

/** 共通のごはん商品の中身。ID・作成日時を除いたもの */
export type CatalogFoodProductContent = Pick<
  CatalogFoodProduct,
  | "name"
  | "manufacturer"
  | "kcalPer100g"
  | "packageAmountG"
  | "packageUnit"
  | "packageSizes"
  | "nutritionType"
  | "textureType"
  | "lifeStages"
  | "targetBreed"
  | "searchKeywords"
>;

/**
 * 入力から共通のごはん商品の中身を作る。管理画面と同じく、`package_amount_g`・`package_unit` には
 * 先頭の候補を、`package_sizes` には先頭を含むすべての候補を書く（`catalogPackageSizes` 参照）
 */
export function toCatalogFoodProductContent(
  values: CatalogFoodProductInput,
): CatalogFoodProductContent {
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
    searchKeywords: values.searchKeywords,
  };
}
