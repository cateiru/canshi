import type { FoodProduct, FoodProductLifeStage } from "@/db/schema";

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
  soup: "スープ",
};

export const LIFE_STAGE_LABEL: Record<FoodProductLifeStage, string> = {
  kitten: "キトン",
  adult: "成猫",
  senior: "シニア",
  care: "療養",
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

/**
 * 対象の猫（ライフステージ）と猫種の表示用文字列。「成猫・シニア ・ ペルシャ」のように並べ、
 * どちらも未設定なら null
 */
export function formatFoodProductTarget(
  foodProduct: Pick<FoodProduct, "lifeStages" | "targetBreed">,
): string | null {
  const parts = [
    foodProduct.lifeStages.map((stage) => LIFE_STAGE_LABEL[stage]).join("・"),
    foodProduct.targetBreed ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ・ ") : null;
}
