import type {
  FeedingMode,
  FoodAmountUnit,
  GivenAmountLevel,
  LeftoverLevel,
} from "@/db/schema";
import { formatFoodAmount } from "@/features/food-products/domain/labels";

export const FEEDING_MODE_LABEL: Record<FeedingMode, string> = {
  strict: "厳格モード",
  approximate: "あいまいモード",
};

export const GIVEN_AMOUNT_LEVEL_LABEL: Record<GivenAmountLevel, string> = {
  less: "少なめ",
  normal: "普通",
  more: "多め",
};

export const LEFTOVER_LEVEL_LABEL: Record<LeftoverLevel, string> = {
  none: "完食",
  little: "少し残し",
  most: "ほとんど残し",
};

/** 厳格モード・あいまいモードの違いを説明するヘルプページ */
export const FEEDING_MODE_HELP_HREF = "/help/feeding-modes";

/**
 * 1回の食事の推定摂取量の見出し。g の商品は「食べた量」、ml の商品（スープ・ミルクなど）は
 * 「飲んだ量」として分けて表示する（`sumFeedingTotals`）
 */
export const FEEDING_INTAKE_LABEL: Record<FoodAmountUnit, string> = {
  g: "食べた量",
  ml: "飲んだ量",
};

type FeedingItemAmounts = {
  /** 商品の量の単位。厳格モードの量はこの単位で表示する */
  amountUnit: FoodAmountUnit;
  givenAmountG: number | null;
  leftoverAmountG: number | null;
  givenAmountLevel: GivenAmountLevel | null;
  leftoverLevel: LeftoverLevel | null;
};

/**
 * 明細の与えた量・残した量を、記録方法に応じた表示用の文字列にする。
 * 厳格モードは商品の単位（g・ml）の量、あいまいモードは段階のラベルで表す
 */
export function formatFeedingItemAmounts(
  mode: FeedingMode,
  item: FeedingItemAmounts,
): { given: string; leftover: string } {
  if (mode === "approximate") {
    return {
      given: item.givenAmountLevel
        ? GIVEN_AMOUNT_LEVEL_LABEL[item.givenAmountLevel]
        : "-",
      leftover: item.leftoverLevel
        ? LEFTOVER_LEVEL_LABEL[item.leftoverLevel]
        : "-",
    };
  }
  return {
    given: formatFoodAmount(item.givenAmountG, item.amountUnit),
    leftover: formatFoodAmount(item.leftoverAmountG, item.amountUnit),
  };
}
