import type { ShampooRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { ShampooRecordFormInput } from "./schema";

/** シャンプーの記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { ShampooRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type ShampooRecordContent = Pick<ShampooRecord, "performedAt" | "memo">;

/** 入力から記録の中身を作る */
export function toShampooRecordContent(
  data: ShampooRecordFormInput,
): ShampooRecordContent {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    memo: data.memo ?? null,
  };
}
