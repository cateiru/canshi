import type { VomitRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { VomitRecordFormInput } from "./schema";

/** 嘔吐の記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { VomitRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type VomitRecordContent = Pick<
  VomitRecord,
  | "occurredAt"
  | "amount"
  | "color"
  | "hasBlood"
  | "hasForeignObject"
  | "appetiteNote"
  | "energyNote"
  | "memo"
>;

/** 入力から記録の中身を作る */
export function toVomitRecordContent(
  data: VomitRecordFormInput,
): VomitRecordContent {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    amount: data.amount ?? null,
    color: data.color ?? null,
    hasBlood: data.hasBlood,
    hasForeignObject: data.hasForeignObject,
    appetiteNote: data.appetiteNote ?? null,
    energyNote: data.energyNote ?? null,
    memo: data.memo ?? null,
  };
}
