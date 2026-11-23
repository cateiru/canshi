// クライアントコンポーネント（商品・記録・プリセットのフォーム）からも参照するため、
// drizzle のテーブル定義を含まないファイルに分けている

/**
 * ごはん商品の量の単位（#672）。`g` はフードなどの重さ、`ml` はスープ・ミルクなどの液体の量。
 * 商品のカロリー（`kcal_per_100g`）・内容量（`package_amount_g`）と、その商品を使ったごはん記録・
 * プリセットの量（`given_amount_g` など）は、列名に `g` が付いていても商品の単位で持つ
 */
export const FOOD_AMOUNT_UNITS = ["g", "ml"] as const;

export type FoodAmountUnit = (typeof FOOD_AMOUNT_UNITS)[number];
