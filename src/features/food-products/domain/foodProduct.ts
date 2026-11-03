import type { FoodProduct } from "@/db/schema";
import type { FoodProductFormInput } from "./schema";

/**
 * ごはん商品（エンティティ）。家（`householdId`）に属する。登録後に家は変えられない
 * （ほかの家のプリセット・ごはん記録から参照されないようにするため）
 */
export type { FoodProduct };

/** ごはん商品の中身。ID・家・共通のごはん商品の追加元・作成日時を除いたもの */
export type FoodProductContent = Pick<
  FoodProduct,
  | "name"
  | "manufacturer"
  | "kcalPer100g"
  | "packageAmountG"
  | "packageUnit"
  | "nutritionType"
  | "textureType"
  | "lifeStages"
  | "targetBreed"
>;

/** 入力からごはん商品の中身を作る */
export function toFoodProductContent(
  data: FoodProductFormInput,
): FoodProductContent {
  return {
    name: data.name,
    manufacturer: data.manufacturer,
    kcalPer100g: data.kcalPer100g,
    packageAmountG: data.packageAmountG,
    packageUnit: data.packageUnit,
    nutritionType: data.nutritionType,
    textureType: data.textureType,
    lifeStages: data.lifeStages,
    targetBreed: data.targetBreed,
  };
}
