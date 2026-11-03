import type { FeedingMode, GivenAmountLevel, LeftoverLevel } from "@/db/schema";

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

type FeedingItemAmounts = {
  givenAmountG: number | null;
  leftoverAmountG: number | null;
  givenAmountLevel: GivenAmountLevel | null;
  leftoverLevel: LeftoverLevel | null;
};

/**
 * 明細の与えた量・残した量を、記録方法に応じた表示用の文字列にする。
 * 厳格モードはグラム、あいまいモードは段階のラベルで表す
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
    given: `${item.givenAmountG ?? "-"} g`,
    leftover: `${item.leftoverAmountG ?? "-"} g`,
  };
}
