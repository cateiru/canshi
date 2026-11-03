import type { WaterRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateEstimatedIntakeMl } from "./calculations";
import type { WaterRecordFormInput } from "./schema";

/** 飲水の記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { WaterRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type WaterRecordContent = Pick<
  WaterRecord,
  | "occurredAt"
  | "measurementMethod"
  | "suppliedAmountMl"
  | "remainingAmountMl"
  | "estimatedIntakeMl"
  | "hasSpill"
  | "wasWaterChanged"
  | "subjectiveAmount"
  | "memo"
>;

/**
 * 入力から記録の中身を作る。推定飲水量は、商品改定などの影響を受けないよう保存時に計算して持つ
 */
export function toWaterRecordContent(
  data: WaterRecordFormInput,
): WaterRecordContent {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    measurementMethod: data.measurementMethod,
    suppliedAmountMl: data.suppliedAmountMl,
    remainingAmountMl: data.remainingAmountMl ?? null,
    estimatedIntakeMl: calculateEstimatedIntakeMl(
      data.suppliedAmountMl,
      data.remainingAmountMl,
    ),
    hasSpill: data.hasSpill,
    wasWaterChanged: data.wasWaterChanged,
    subjectiveAmount: data.subjectiveAmount ?? null,
    memo: data.memo ?? null,
  };
}
