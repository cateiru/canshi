import type { Cat } from "@/db/schema";
import { COAT_COLOR_LABEL, COAT_PATTERN_LABEL } from "./labels";

/** 猫の毛色・柄（値オブジェクト）。プリセットから選び、それぞれ null は未設定 */
export type Coat = Readonly<
  Pick<Cat, "coatColor" | "coatPattern" | "coatWhite">
>;

/** 1 行にまとめるときの白い毛の割合 */
const COAT_WHITE_SUMMARY: Record<NonNullable<Coat["coatWhite"]>, string> = {
  none: "白なし",
  low: "白少し",
  medium: "白半分くらい",
  high: "ほとんど白",
};

/**
 * 毛色・柄を「ベース色・柄・白い毛の割合」の順に 1 行にまとめる（例：「茶（レッド）・縞（トラ）・白少し」）。
 * 未設定の項目は省き、すべて未設定なら null
 */
export function formatCoat(coat: Coat): string | null {
  const parts = [
    coat.coatColor ? COAT_COLOR_LABEL[coat.coatColor] : null,
    coat.coatPattern ? COAT_PATTERN_LABEL[coat.coatPattern] : null,
    coat.coatWhite ? COAT_WHITE_SUMMARY[coat.coatWhite] : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join("・") : null;
}
