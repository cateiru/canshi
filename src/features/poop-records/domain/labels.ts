import type { PoopRecord } from "@/db/schema";

export const CONSISTENCY_LABEL: Record<PoopRecord["consistency"], string> = {
  hard: "硬い",
  normal: "ふつう",
  soft: "柔らかい",
  liquid: "液体",
};

/** フォームの選択肢や凡例など、表示順を揃えたい箇所で使う */
export const CONSISTENCY_ORDER: PoopRecord["consistency"][] = [
  "hard",
  "normal",
  "soft",
  "liquid",
];
