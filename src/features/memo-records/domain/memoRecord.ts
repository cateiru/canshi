import type { MemoRecord } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { MemoRecordFormInput } from "./schema";

/** メモの記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { MemoRecord };

/** 記録の中身。ID・猫・作成日時など、保存のたびに変わらない項目を除いたもの */
export type MemoRecordContent = Pick<MemoRecord, "recordedAt" | "content"> & {
  /** 付けるラベルの ID（重複なし）。猫の家のラベルに限る */
  labelIds: string[];
  /** 付けるラベルの名前（重複なし）。猫の家にまだないラベルは、保存と同時に作る */
  labelNames: string[];
};

/**
 * 入力のラベルを、ID で付けるものと、名前で付けるもの（なければ作る）に分ける。
 * 画面で付けた既存のラベルは、画面を開いた後に名前が変わっていてもそのラベルのままになるよう、ID で付ける。
 * 画面を開いた後に削除されていれば（猫の家のラベルになければ）、新しく入力したラベルと同じく名前で付ける
 */
export function resolveMemoLabels(
  { labelIds, labels }: Pick<MemoRecordFormInput, "labelIds" | "labels">,
  householdLabelIds: ReadonlySet<string>,
): Pick<MemoRecordContent, "labelIds" | "labelNames"> {
  const ids = new Set(labelIds);
  const names = new Set<string>();
  for (const { id, name } of labels) {
    if (id != null && householdLabelIds.has(id)) {
      ids.add(id);
    } else {
      names.add(name);
    }
  }
  return { labelIds: [...ids], labelNames: [...names] };
}

/** 入力から記録の中身を作る。`householdLabelIds` は猫の家のラベルの ID */
export function toMemoRecordContent(
  data: MemoRecordFormInput,
  householdLabelIds: ReadonlySet<string>,
): MemoRecordContent {
  return {
    recordedAt:
      data.recordedDate != null && data.recordedTime != null
        ? combineDateTimeUtc(data.recordedDate, data.recordedTime)
        : null,
    content: data.content,
    ...resolveMemoLabels(data, householdLabelIds),
  };
}
