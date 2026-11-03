import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { memoRecords } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { MEMO_RECORD_MEDIA_TYPE } from "./media";
import type { MemoRecordFormInput } from "./schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: MemoRecordFormInput) {
  return {
    recordedAt:
      data.recordedDate != null && data.recordedTime != null
        ? combineDateTimeUtc(data.recordedDate, data.recordedTime)
        : null,
    content: data.content,
  };
}

/** 記録を追加し、その ID を返す */
export async function createMemoRecord(
  catId: string,
  data: MemoRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(memoRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: memoRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateMemoRecord(
  catId: string,
  id: string,
  data: MemoRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(memoRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
    .returning({ id: memoRecords.id });
  return result.length > 0;
}

/**
 * 猫の記録を、紐付く画像（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deleteMemoRecord(
  catId: string,
  id: string,
): Promise<boolean> {
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: memoRecords.id })
    .from(memoRecords)
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
    .limit(1);
  if (!existing) return false;
  // 紐付く画像を先に削除する
  await deleteMediaAssetsByRecord(MEMO_RECORD_MEDIA_TYPE, id);
  await db
    .delete(memoRecords)
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)));
  return true;
}
