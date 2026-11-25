import type { RecordActor } from "@/db/schema";
import { toMemoRecordContent } from "../domain/memoRecord";
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

/** ID で指定したラベルがすべて猫の家のラベルであれば true */
async function areLabelsInHousehold(
  householdId: string,
  labelIds: string[],
  d1?: D1Database,
): Promise<boolean> {
  if (labelIds.length === 0) {
    return true;
  }
  const labels = await listMemoLabels(householdId, d1);
  const householdLabelIds = new Set(labels.map(({ id }) => id));
  return labelIds.every((id) => householdLabelIds.has(id));
}

/** 記録を追加する。ID で指定したラベルは猫の家のものに限り、名前で指定したラベルはなければ作る */
export async function createMemoRecord(
  cat: MemoRecordCat,
  data: MemoRecordFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<SaveMemoRecordResult> {
  if (!(await areLabelsInHousehold(cat.householdId, data.labelIds, d1))) {
    return { failure: "labelNotFound" };
  }
  const id = await createMemoRecordRepository(d1).add(
    cat.id,
    toMemoRecordContent(data),
    actor,
  );
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
  if (!(await areLabelsInHousehold(cat.householdId, data.labelIds, d1))) {
    return { failure: "labelNotFound" };
  }
  const updated = await createMemoRecordRepository(d1).update(
    cat.id,
    id,
    toMemoRecordContent(data),
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
