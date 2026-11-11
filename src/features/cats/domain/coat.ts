import type { Cat } from "@/db/schema";
import { COAT_COLOR_LABEL } from "./labels";

/** 猫の毛色（値オブジェクト）。ベース色をプリセットから選び、null は未設定 */
export type Coat = Readonly<Pick<Cat, "coatColor">>;

/** 毛色の名前（例：「黒と茶」）。未設定なら null */
export function formatCoat(coat: Coat): string | null {
  return coat.coatColor ? COAT_COLOR_LABEL[coat.coatColor] : null;
}
