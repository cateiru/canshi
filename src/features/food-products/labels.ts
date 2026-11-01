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

/** 商品を使っているもの。使われている商品は削除できない */
export type FoodProductUsage = "feedingRecord" | "feedingPreset";

/** 使われている商品を削除しようとしたときに、削除できない理由として表示する文言 */
export const FOOD_PRODUCT_IN_USE_MESSAGE: Record<FoodProductUsage, string> = {
  feedingRecord: "この商品を使ったごはん記録があるため削除できません",
  feedingPreset: "この商品を使ったプリセットがあるため削除できません",
};

/**
 * 内容量の数値と単位。1000g 以上は kg にする（1500 → 「1.5」「kg」）。
 * 割り算で出る誤差（1100.1 / 1000 = 1.1001000000000001 など）は丸めて消す
 */
export function packageAmountParts(packageAmountG: number): {
  value: string;
  unit: "g" | "kg";
} {
  if (packageAmountG >= 1000) {
    return {
      value: String(Number((packageAmountG / 1000).toPrecision(12))),
      unit: "kg",
    };
  }
  return { value: String(packageAmountG), unit: "g" };
}

/**
 * 内容量の表示用文字列。単位があれば「14g/本」、なければ商品全体として「1.5kg」
 */
export function formatPackageAmount(
  foodProduct: Pick<FoodProduct, "packageAmountG" | "packageUnit">,
): string {
  const { value, unit } = packageAmountParts(foodProduct.packageAmountG);
  const amount = `${value}${unit}`;
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
