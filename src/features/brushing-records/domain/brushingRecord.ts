import type { BrushingRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { BrushingRecordFormInput } from "./schema";

/** ブラッシングの記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { BrushingRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type BrushingRecordContent = Pick<
  BrushingRecord,
  | "performedAt"
  | "durationMinutes"
  | "shedAmount"
  | "hasMats"
  | "hasSkinIssue"
  | "memo"
>;

/** 入力から記録の中身を作る */
export function toBrushingRecordContent(
  data: BrushingRecordFormInput,
): BrushingRecordContent {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    durationMinutes: data.durationMinutes ?? null,
    shedAmount: data.shedAmount ?? null,
    hasMats: data.hasMats,
    hasSkinIssue: data.hasSkinIssue,
    memo: data.memo ?? null,
  };
}
