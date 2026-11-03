import type { MemoRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { MemoRecordFormInput } from "./schema";

/** メモの記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { MemoRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type MemoRecordContent = Pick<MemoRecord, "recordedAt" | "content">;

/** 入力から記録の中身を作る */
export function toMemoRecordContent(
  data: MemoRecordFormInput,
): MemoRecordContent {
  return {
    recordedAt:
      data.recordedDate != null && data.recordedTime != null
        ? combineDateTimeUtc(data.recordedDate, data.recordedTime)
        : null,
    content: data.content,
  };
}
