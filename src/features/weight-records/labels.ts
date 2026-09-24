import type { WeightRecord } from "@/db/schema";

export const INPUT_METHOD_LABEL: Record<WeightRecord["inputMethod"], string> = {
  auto: "自動算出",
  direct: "直接入力",
};

/** ボディコンディションスコア（BCS）の値。3 が理想体重 */
export type BodyConditionScore = 1 | 2 | 3 | 4 | 5;

export const BCS_VALUES: BodyConditionScore[] = [1, 2, 3, 4, 5];

export function isBodyConditionScore(
  value: number | null | undefined,
): value is BodyConditionScore {
  return value != null && (BCS_VALUES as number[]).includes(value);
}

export const BCS_LABEL: Record<BodyConditionScore, string> = {
  1: "痩せ",
  2: "やや痩せ",
  3: "理想体重",
  4: "やや肥満",
  5: "肥満",
};

// 環境省「飼い主のためのペットフード・ガイドライン」の猫の BCS 表の記述に基づく
export const BCS_DESCRIPTION: Record<BodyConditionScore, string> = {
  1: "肋骨・腰椎・骨盤が外から容易に見える。首が細く、上から見て腰が深くくびれている。横から見て腹部の吊り上がりが顕著。脇腹のひだには脂肪がないか、ひだ自体がない。",
  2: "背骨と肋骨が容易に触れる。上から見て腰のくびれは最小。横から見て腹部の吊り上がりはわずか。",
  3: "肋骨は触れるが、見ることはできない。上から見て肋骨の後ろに腰のくびれがわずかに見られる。横から見て腹部の吊り上がり、脇腹にひだがある。",
  4: "肋骨の上に脂肪がわずかに沈着するが、肋骨は容易に触れる。横から見て腹部の吊り上がりはやや丸くなり、脇腹は窪んでいる。脇腹のひだは適量の脂肪で垂れ下がり、歩くと揺れるのに気づく。",
  5: "肋骨や背骨は厚い脂肪におおわれて容易に触れない。横から見て腹部の吊り上がりは丸く、上から見て腰のくびれはほとんど見られない。脇腹のひだが目立ち、歩くと盛んに揺れる。",
};

/** 一覧・タイムラインで使う「BCS 3（理想体重）」形式の表示 */
export function formatBcs(bcs: BodyConditionScore): string {
  return `BCS ${bcs}（${BCS_LABEL[bcs]}）`;
}
