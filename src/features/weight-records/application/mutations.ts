import type { WeightRecordFormInput } from "../domain/schema";
import { toWeightRecordContent } from "../domain/weightRecord";
import { createWeightRecordRepository } from "../infrastructure/weightRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createWeightRecord(
  catId: string,
  data: WeightRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createWeightRecordRepository(d1).add(
    catId,
    toWeightRecordContent(data),
  );
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateWeightRecord(
  catId: string,
  id: string,
  data: WeightRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createWeightRecordRepository(d1).update(
    catId,
    id,
    toWeightRecordContent(data),
  );
}

/** 猫の記録を論理削除する（削除日時を入れ、一覧・タイムライン・集計から除く）。見つからなければ false */
export async function deleteWeightRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createWeightRecordRepository(d1).remove(catId, id);
}
