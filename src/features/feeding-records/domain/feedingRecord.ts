import type {
  FeedingRecord,
  FeedingRecordItem,
  FoodProduct,
} from "@/db/schema";
import { NOTIFY_TIMEZONE } from "@/features/notifications/domain/defaults";
import { getNaiveLocalNow } from "@/features/notifications/domain/rules/localDate";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
} from "./calculations";
import type { FeedingRecordFormInput } from "./schema";

/**
 * ごはん記録（エンティティ）。猫（`catId`）に属し、明細（`FeedingRecordItem`）を持つ。
 * 明細の商品は、猫の家の商品に限る
 */
export type { FeedingRecord, FeedingRecordItem };

/** 明細の中身。ID・記録を除いたもの */
export type FeedingRecordItemContent = Pick<
  FeedingRecordItem,
  | "foodProductId"
  | "givenAmountG"
  | "leftoverAmountG"
  | "estimatedIntakeG"
  | "estimatedKcal"
  | "givenAmountLevel"
  | "leftoverLevel"
  | "sortOrder"
>;

/** 記録の中身。日時・入力方法と、並び順どおりの明細 */
export type FeedingRecordContent = Pick<
  FeedingRecord,
  "occurredAt" | "mode"
> & {
  items: FeedingRecordItemContent[];
};

/** 明細の推定カロリーの計算に使う商品の項目 */
export type FeedingRecordFoodProduct = Pick<
  FoodProduct,
  "id" | "householdId" | "kcalPer100g"
>;

/** 入力が参照する商品の ID（重複を除く） */
export function feedingRecordFoodProductIds(
  input: FeedingRecordFormInput,
): string[] {
  return [...new Set(input.items.map((item) => item.foodProductId))];
}

/**
 * 入力から記録の中身を作る。明細の商品は、猫の家（`householdId`）の商品に限る。
 * 以前は猫を別の家へ引っ越せた（#502 で廃止）ため、引っ越す前の記録は元の家の商品を使っていることがある。
 * その記録を編集するときは、記録ですでに使っている商品（元の家の商品）も、そのまま残せるよう
 * `keptFoodProductIds` で許可する。
 * `products` は入力が参照する商品（`feedingRecordFoodProductIds`）のうち、見つかったもの
 */
export function toFeedingRecordContent(
  input: FeedingRecordFormInput,
  products: FeedingRecordFoodProduct[],
  householdId: string | null,
  keptFoodProductIds: string[] = [],
): { error: string } | { content: FeedingRecordContent } {
  const foodProductIds = feedingRecordFoodProductIds(input);
  const productById = new Map(
    products
      .filter(
        (product) =>
          (householdId != null && product.householdId === householdId) ||
          keptFoodProductIds.includes(product.id),
      )
      .map((product) => [product.id, product]),
  );

  if (productById.size !== foodProductIds.length) {
    return { error: "選択された商品が見つかりませんでした" };
  }

  const occurredAt = combineDateTimeUtc(input.occurredDate, input.occurredTime);

  // あいまいモードは量を段階でしか持たないため、摂取量・カロリーは計算しない
  if (input.mode === "approximate") {
    const items = input.items.map((item, index) => ({
      foodProductId: item.foodProductId,
      givenAmountG: null,
      leftoverAmountG: null,
      estimatedIntakeG: null,
      estimatedKcal: null,
      givenAmountLevel: item.givenAmountLevel,
      leftoverLevel: item.leftoverLevel,
      sortOrder: index,
    }));
    return { content: { occurredAt, mode: input.mode, items } };
  }

  const items = input.items.map((item, index) => {
    // biome-ignore lint/style/noNonNullAssertion: 上の size チェックで全件存在を確認済み
    const product = productById.get(item.foodProductId)!;
    const estimatedIntakeG = calculateEstimatedIntakeG(
      item.givenAmountG,
      item.leftoverAmountG,
    );
    return {
      foodProductId: item.foodProductId,
      givenAmountG: item.givenAmountG,
      leftoverAmountG: item.leftoverAmountG,
      estimatedIntakeG,
      estimatedKcal: calculateEstimatedKcal(
        estimatedIntakeG,
        product.kcalPer100g,
      ),
      givenAmountLevel: null,
      leftoverLevel: null,
      sortOrder: index,
    };
  });
  return { content: { occurredAt, mode: input.mode, items } };
}

/**
 * ごはんを記録したら、猫の家の未対応のごはんの時間の通知（時間のお知らせ・記録がないときの
 * リマインダー）はもう対応する必要がないため完了にする。通知は猫ごとではなく家に 1 件のため、
 * 家のどの猫を記録しても完了にする。
 *
 * 先の日時の記録はまだあげていないため完了にしない（通知の判定でも数えない）。
 * 発生日時は naive UTC のため、現在時刻もローカル時計の数字の naive UTC にして比べる
 * （`evaluateFeedingSchedule` と同じ）。
 * ごはんの時刻の前後の範囲では絞らない。リマインダーは次の時刻との中間に出ることもあるため、
 * それを見てから記録すると次の時刻の範囲に入り、応えた通知が残ってしまうため
 */
export function completesFeedingNotifications(
  occurredAt: Date,
  now: Date = new Date(),
): boolean {
  return (
    occurredAt.getTime() <= getNaiveLocalNow(now, NOTIFY_TIMEZONE).getTime()
  );
}
