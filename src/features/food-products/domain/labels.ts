import type {
  FoodAmountUnit,
  FoodProduct,
  FoodProductLifeStage,
} from "@/db/schema";

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

/** 量の単位の選択肢の表示名 */
export const AMOUNT_UNIT_LABEL: Record<FoodAmountUnit, string> = {
  g: "g（フードなど）",
  ml: "ml（スープ・ミルクなど）",
};

/** カロリーの単位（「kcal/100g」「kcal/100ml」） */
export function kcalPer100Unit(amountUnit: FoodAmountUnit): string {
  return `kcal/100${amountUnit}`;
}

/** 量を単位付きの表示用文字列にする（「30 g」「50 ml」）。量がなければ「- g」 */
export function formatFoodAmount(
  amount: number | null,
  amountUnit: FoodAmountUnit,
): string {
  return `${amount ?? "-"} ${amountUnit}`;
}

/** 1000 以上の内容量を表す単位（1000g は 1kg、1000ml は 1L） */
const LARGE_AMOUNT_UNIT: Record<FoodAmountUnit, string> = {
  g: "kg",
  ml: "L",
};

/** 商品を使っているもの。使われている商品は削除できない */
export type FoodProductUsage = "feedingRecord" | "feedingPreset";

/** 使われている商品を削除しようとしたときに、削除できない理由として表示する文言 */
export const FOOD_PRODUCT_IN_USE_MESSAGE: Record<FoodProductUsage, string> = {
  feedingRecord: "この商品を使ったごはん記録があるため削除できません",
  feedingPreset: "この商品を使ったプリセットがあるため削除できません",
};

/**
 * 内容量の数値と単位。1000g 以上は kg、1000ml 以上は L にする（1500g → 「1.5」「kg」）。
 * 割り算で出る誤差（1100.1 / 1000 = 1.1001000000000001 など）は丸めて消す
 */
export function packageAmountParts(
  packageAmount: number,
  amountUnit: FoodAmountUnit,
): {
  value: string;
  unit: string;
} {
  if (packageAmount >= 1000) {
    return {
      value: String(Number((packageAmount / 1000).toPrecision(12))),
      unit: LARGE_AMOUNT_UNIT[amountUnit],
    };
  }
  return { value: String(packageAmount), unit: amountUnit };
}

/**
 * 内容量の表示用文字列。単位があれば「14g/本」、なければ商品全体として「1.5kg」「200ml」
 */
export function formatPackageAmount(
  foodProduct: Pick<
    FoodProduct,
    "packageAmountG" | "packageUnit" | "amountUnit"
  >,
): string {
  const { value, unit } = packageAmountParts(
    foodProduct.packageAmountG,
    foodProduct.amountUnit,
  );
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
