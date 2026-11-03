import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { VOMIT_RECORD_MEDIA_TYPE } from "../domain/media";
import type { VomitRecordFormInput } from "../domain/schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: VomitRecordFormInput) {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    amount: data.amount ?? null,
    color: data.color ?? null,
    hasBlood: data.hasBlood,
    hasForeignObject: data.hasForeignObject,
    appetiteNote: data.appetiteNote ?? null,
    energyNote: data.energyNote ?? null,
    memo: data.memo ?? null,
  };
}

/** 記録を追加し、その ID を返す */
export async function createVomitRecord(
  catId: string,
  data: VomitRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(vomitRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: vomitRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateVomitRecord(
  catId: string,
  id: string,
  data: VomitRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(vomitRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
    .returning({ id: vomitRecords.id });
  return result.length > 0;
}

/**
 * 猫の記録を、紐付く写真（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deleteVomitRecord(
  catId: string,
  id: string,
): Promise<boolean> {
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: vomitRecords.id })
    .from(vomitRecords)
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
    .limit(1);
  if (!existing) return false;
  // 紐付く写真を先に削除する
  await deleteMediaAssetsByRecord(VOMIT_RECORD_MEDIA_TYPE, id);
  await db
    .delete(vomitRecords)
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)));
  return true;
}
