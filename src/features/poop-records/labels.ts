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

// 便の状態ごとの色。血液・異物のバッジ（error/warning）と同じ
// 「液体ほど注意」の方向感に揃える。グラフの凡例と点の色分けで使う
export const CONSISTENCY_COLOR: Record<PoopRecord["consistency"], string> = {
  hard: "var(--color-warning)",
  normal: "var(--color-success)",
  soft: "var(--color-info)",
  liquid: "var(--color-error)",
};
