import { registerBasicOperations } from "./basics";
import { registerCatalogFoodProductOperations } from "./catalogFoodProducts";
import { registerCatOperations } from "./cats";
import type { OperationContext } from "./context";
import { registerFeedingPresetOperations } from "./feedingPresets";
import { registerFeedingScheduleOperations } from "./feedingSchedules";
import { registerFoodProductOperations } from "./foodProducts";
import { registerHouseholdOperations } from "./households";
import { registerMemoLabelOperations } from "./memoLabels";
import { registerRecordOperations } from "./records";
import type { OperationRegistry } from "./registry";

/**
 * 外部接続（AI との接続・API）から行えるすべての操作を登録する。猫のプロフィール・タイムラインの
 * 読み取り、記録の追加・編集、ごはん商品・プリセット・共通のごはん商品、家の名前・メンバー・招待、
 * 猫のプロフィール・通知の設定、ごはんの時間、メモのラベルを扱う
 */
export function registerOperations(
  registry: OperationRegistry,
  ctx: OperationContext,
) {
  registerBasicOperations(registry, ctx);
  registerRecordOperations(registry, ctx);
  registerFoodProductOperations(registry, ctx);
  registerFeedingPresetOperations(registry, ctx);
  registerCatalogFoodProductOperations(registry, ctx);
  registerHouseholdOperations(registry, ctx);
  registerCatOperations(registry, ctx);
  registerFeedingScheduleOperations(registry, ctx);
  registerMemoLabelOperations(registry, ctx);
}
