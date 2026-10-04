// クライアントコンポーネント（記録・プリセットのフォーム）からも参照するため、
// drizzle のテーブル定義を含まないファイルに分けている

/**
 * ごはん記録の記録方法。
 * - strict（厳格モード）: 与えた量・残した量をグラム単位で記録し、摂取量・カロリーを計算する
 * - approximate（あいまいモード）: 与えた量・残した量を段階で記録し、摂取量・カロリーは計算しない
 *
 * モードは記録単位で持ち、1回の食事の中で商品ごとにモードを混在させることはできない
 */
export const FEEDING_MODES = ["strict", "approximate"] as const;

/** あいまいモードの与えた量（少なめ・普通・多め） */
export const GIVEN_AMOUNT_LEVELS = ["less", "normal", "more"] as const;

/** あいまいモードの残した量（完食・少し残し・ほとんど残し） */
export const LEFTOVER_LEVELS = ["none", "little", "most"] as const;

export type FeedingMode = (typeof FEEDING_MODES)[number];
export type GivenAmountLevel = (typeof GIVEN_AMOUNT_LEVELS)[number];
export type LeftoverLevel = (typeof LEFTOVER_LEVELS)[number];
