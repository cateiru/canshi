import { toMemoRecordContent } from "../domain/memoRecord";
import type { MemoRecordFormInput } from "../domain/schema";
import { createMemoRecordRepository } from "../infrastructure/memoRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createMemoRecord(
  catId: string,
  data: MemoRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createMemoRecordRepository(d1).add(catId, toMemoRecordContent(data));
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateMemoRecord(
  catId: string,
  id: string,
  data: MemoRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createMemoRecordRepository(d1).update(
    catId,
    id,
    toMemoRecordContent(data),
  );
}

/**
 * 猫の記録を論理削除する（削除日時を入れ、一覧・タイムライン・集計から除く）。
 * 紐付く画像（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからなければ false
 */
export async function deleteMemoRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createMemoRecordRepository(d1).remove(catId, id);
}
