import { toPoopRecordContent } from "../domain/poopRecord";
import type { PoopRecordFormInput } from "../domain/schema";
import { createPoopRecordRepository } from "../infrastructure/poopRecordRepository";

/*
 * うんちの記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createPoopRecord(
  catId: string,
  data: PoopRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createPoopRecordRepository(d1).add(catId, toPoopRecordContent(data));
}

/** 猫の記録を更新する。見つからなければ false */
export async function updatePoopRecord(
  catId: string,
  id: string,
  data: PoopRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createPoopRecordRepository(d1).update(
    catId,
    id,
    toPoopRecordContent(data),
  );
}

/**
 * 猫の記録を論理削除する（削除日時を入れ、一覧・タイムライン・集計から除く）。
 * 紐付く写真（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからなければ false
 */
export async function deletePoopRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createPoopRecordRepository(d1).remove(catId, id);
}
