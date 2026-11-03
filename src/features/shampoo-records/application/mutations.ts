import type { ShampooRecordFormInput } from "../domain/schema";
import { toShampooRecordContent } from "../domain/shampooRecord";
import { createShampooRecordRepository } from "../infrastructure/shampooRecordRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 記録を追加し、その ID を返す */
export async function createShampooRecord(
  catId: string,
  data: ShampooRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  return createShampooRecordRepository(d1).add(
    catId,
    toShampooRecordContent(data),
  );
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateShampooRecord(
  catId: string,
  id: string,
  data: ShampooRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createShampooRecordRepository(d1).update(
    catId,
    id,
    toShampooRecordContent(data),
  );
}

/** 猫の記録を削除する。見つからなければ false */
export async function deleteShampooRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createShampooRecordRepository(d1).remove(catId, id);
}
