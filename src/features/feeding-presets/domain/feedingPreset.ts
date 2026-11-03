import type { FeedingPreset, FeedingPresetItem } from "@/db/schema";
import type { FeedingPresetFormInput } from "./schema";

/**
 * ごはんプリセット（エンティティ）。家（`householdId`）に属し、明細（`FeedingPresetItem`）を持つ。
 * 登録後に家は変えられない
 */
export type { FeedingPreset, FeedingPresetItem };

/** 明細の中身。ID・プリセットを除いたもの */
export type FeedingPresetItemContent = Pick<
  FeedingPresetItem,
  "foodProductId" | "givenAmountG" | "givenAmountLevel" | "sortOrder"
>;

/** プリセットの中身。名前・入力方法と、並び順どおりの明細 */
export type FeedingPresetContent = Pick<FeedingPreset, "name" | "mode"> & {
  items: FeedingPresetItemContent[];
};

/**
 * 入力からプリセットの中身を作る。目安で入力するプリセット（`approximate`）は量の段階だけを、
 * グラムで入力するプリセットはグラムだけを持つ
 */
export function toFeedingPresetContent(
  input: FeedingPresetFormInput,
): FeedingPresetContent {
  const items: FeedingPresetItemContent[] =
    input.mode === "approximate"
      ? input.items.map((item, index) => ({
          foodProductId: item.foodProductId,
          givenAmountG: null,
          givenAmountLevel: item.givenAmountLevel,
          sortOrder: index,
        }))
      : input.items.map((item, index) => ({
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG,
          givenAmountLevel: null,
          sortOrder: index,
        }));
  return { name: input.name, mode: input.mode, items };
}

/** 明細が参照する商品の ID（重複を除く） */
export function feedingPresetFoodProductIds(
  content: FeedingPresetContent,
): string[] {
  return [...new Set(content.items.map((item) => item.foodProductId))];
}
