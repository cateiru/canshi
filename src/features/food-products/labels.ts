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
