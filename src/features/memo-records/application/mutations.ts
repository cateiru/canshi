import type { RecordActor } from "@/db/schema";
import {
  type MemoRecordContent,
  toMemoRecordContent,
} from "../domain/memoRecord";
import type { MemoRecordFormInput } from "../domain/schema";
import { listMemoLabels } from "../infrastructure/labelQueries";
import { createMemoRecordRepository } from "../infrastructure/memoRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** メモの猫。ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照） */
type MemoRecordCat = { id: string; householdId: string };

/** 保存できなかった理由。`rejected` は、記録が見つからない・猫がメモリーへ移された */
export type SaveMemoRecordFailure = "labelNotFound" | "rejected";

export type SaveMemoRecordResult =
  | { id: string }
  | { failure: SaveMemoRecordFailure };

/** 入力から記録の中身を作る。`labelIds` に猫の家のラベルではないものがあれば null */
async function toContent(
  householdId: string,
  data: MemoRecordFormInput,
  d1?: D1Database,
): Promise<MemoRecordContent | null> {
  const usesIds =
    data.labelIds.length > 0 || data.labels.some(({ id }) => id != null);
  const householdLabelIds = new Set(
    usesIds ? (await listMemoLabels(householdId, d1)).map(({ id }) => id) : [],
  );
  return data.labelIds.every((id) => householdLabelIds.has(id))
    ? toMemoRecordContent(data, householdLabelIds)
    : null;
}

/** 記録を追加する。`labelIds` は猫の家のラベルに限り、画面で付けた `labels` のうち家にないラベルは作る */
export async function createMemoRecord(
  cat: MemoRecordCat,
  data: MemoRecordFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<SaveMemoRecordResult> {
  const content = await toContent(cat.householdId, data, d1);
  if (!content) {
    return { failure: "labelNotFound" };
  }
  const id = await createMemoRecordRepository(d1).add(cat.id, content, actor);
  return id == null ? { failure: "rejected" } : { id };
}

/** 猫の記録を更新し、ラベルを付け直す。ラベルの扱いは `createMemoRecord` と同じ */
export async function updateMemoRecord(
  cat: MemoRecordCat,
  id: string,
  data: MemoRecordFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<SaveMemoRecordResult> {
  const content = await toContent(cat.householdId, data, d1);
  if (!content) {
    return { failure: "labelNotFound" };
  }
  const updated = await createMemoRecordRepository(d1).update(
    cat.id,
    id,
    content,
    actor,
  );
  return updated ? { id } : { failure: "rejected" };
}

/**
 * 猫の記録を論理削除する（削除日時を入れ、一覧・タイムライン・集計から除く）。
 * 紐付く画像（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからない・猫がメモリーへ移されていれば false
 */
export async function deleteMemoRecord(
  catId: string,
  id: string,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  return createMemoRecordRepository(d1).remove(catId, id, actor);
}
