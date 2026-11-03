import type { WeightRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateCatWeightKg } from "./calculations";
import type { WeightRecordFormInput } from "./schema";

/** 体重の記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { WeightRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type WeightRecordContent = Pick<
  WeightRecord,
  | "occurredAt"
  | "inputMethod"
  | "combinedWeightKg"
  | "humanWeightKg"
  | "catWeightKg"
  | "bcs"
>;

function resolveCatWeightKg(data: WeightRecordFormInput): number {
  if (data.inputMethod === "auto") {
    // フォームのバリデーションで両方の値が存在することを保証済み
    return calculateCatWeightKg(
      data.combinedWeightKg as number,
      data.humanWeightKg as number,
    );
  }
  return data.catWeightKg as number;
}

/** 入力から記録の中身を作る */
export function toWeightRecordContent(
  data: WeightRecordFormInput,
): WeightRecordContent {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    inputMethod: data.inputMethod,
    combinedWeightKg: data.combinedWeightKg ?? null,
    humanWeightKg: data.humanWeightKg ?? null,
    catWeightKg: resolveCatWeightKg(data),
    bcs: data.bcs ?? null,
  };
}
