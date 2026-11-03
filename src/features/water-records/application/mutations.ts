import type { WaterRecordFormInput } from "../domain/schema";
import { toWaterRecordContent } from "../domain/waterRecord";
import { createWaterRecordRepository } from "../infrastructure/waterRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createWaterRecord(
  catId: string,
  data: WaterRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createWaterRecordRepository(d1).add(catId, toWaterRecordContent(data));
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateWaterRecord(
  catId: string,
  id: string,
  data: WaterRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createWaterRecordRepository(d1).update(
    catId,
    id,
    toWaterRecordContent(data),
  );
}

/** 猫の記録を削除する。見つからなければ false */
export async function deleteWaterRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createWaterRecordRepository(d1).remove(catId, id);
}
