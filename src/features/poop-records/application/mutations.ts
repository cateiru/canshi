import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { POOP_RECORD_MEDIA_TYPE } from "../domain/media";
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
 * 猫の記録を、紐付く写真（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deletePoopRecord(
  catId: string,
  id: string,
): Promise<boolean> {
  const repository = createPoopRecordRepository();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  if (!(await repository.existsForCat(catId, id))) return false;
  // 紐付く写真を先に削除する
  await deleteMediaAssetsByRecord(POOP_RECORD_MEDIA_TYPE, id);
  await repository.remove(catId, id);
  return true;
}
