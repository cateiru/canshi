import type { FoodProduct } from "@/db/schema";

export const NUTRITION_TYPE_LABEL: Record<
  FoodProduct["nutritionType"],
  string
> = {
  complete: "総合栄養食",
  general: "一般食",
};

export const TEXTURE_TYPE_LABEL: Record<FoodProduct["textureType"], string> = {
  dry: "ドライ",
  wet: "ウェット",
};

/**
 * 内容量の表示用文字列。単位があれば「14g/本」、なければ商品全体として「1500g」
 */
export function formatPackageAmount(
  foodProduct: Pick<FoodProduct, "packageAmountG" | "packageUnit">,
): string {
  const amount = `${foodProduct.packageAmountG}g`;
  return foodProduct.packageUnit
    ? `${amount}/${foodProduct.packageUnit}`
    : amount;
}
