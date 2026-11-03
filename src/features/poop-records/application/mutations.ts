import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { POOP_RECORD_MEDIA_TYPE } from "../domain/media";
import type { PoopRecordFormInput } from "../domain/schema";

/*
 * うんちの記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: PoopRecordFormInput) {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    amount: data.amount ?? null,
    color: data.color ?? null,
    consistency: data.consistency,
    hasBlood: data.hasBlood,
    hasForeignObject: data.hasForeignObject,
    appetiteNote: data.appetiteNote ?? null,
    energyNote: data.energyNote ?? null,
    memo: data.memo ?? null,
  };
}

/** 記録を追加し、その ID を返す */
export async function createPoopRecord(
  catId: string,
  data: PoopRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(poopRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: poopRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updatePoopRecord(
  catId: string,
  id: string,
  data: PoopRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(poopRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
    .returning({ id: poopRecords.id });
  return result.length > 0;
}

/**
 * 猫の記録を、紐付く写真（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deletePoopRecord(
  catId: string,
  id: string,
): Promise<boolean> {
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: poopRecords.id })
    .from(poopRecords)
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
    .limit(1);
  if (!existing) return false;
  // 紐付く写真を先に削除する
  await deleteMediaAssetsByRecord(POOP_RECORD_MEDIA_TYPE, id);
  await db
    .delete(poopRecords)
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)));
  return true;
}
