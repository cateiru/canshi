import { toBrushingRecordContent } from "../domain/brushingRecord";
import type { BrushingRecordFormInput } from "../domain/schema";
import { createBrushingRecordRepository } from "../infrastructure/brushingRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createBrushingRecord(
  catId: string,
  data: BrushingRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createBrushingRecordRepository(d1).add(
    catId,
    toBrushingRecordContent(data),
  );
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateBrushingRecord(
  catId: string,
  id: string,
  data: BrushingRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createBrushingRecordRepository(d1).update(
    catId,
    id,
    toBrushingRecordContent(data),
  );
}

/** 猫の記録を削除する。見つからなければ false */
export async function deleteBrushingRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createBrushingRecordRepository(d1).remove(catId, id);
}
