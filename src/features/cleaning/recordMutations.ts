import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cleaningRecords, cleaningTargets } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { CleaningRecordFormInput } from "./recordSchema";

/*
 * 記録の保存。画面（`./recordActions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: CleaningRecordFormInput) {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    memo: data.memo ?? null,
  };
}

/**
 * 記録を追加し、その ID を返す。掃除対象が猫のもので、有効なときだけ追加し、そうでなければ null。
 * 掃除対象の ID は URL・AI から任意の値を渡せるため、他猫や無効化済みの掃除対象に記録が
 * 紐付いてしまうのを防ぐ（無効対象は編集・記録閲覧のみが仕様のため新規登録は拒否する）
 */
export async function createCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  data: CleaningRecordFormInput,
  d1?: D1Database,
): Promise<string | null> {
  const db = getDb(d1);
  const [target] = await db
    .select({ id: cleaningTargets.id })
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
        eq(cleaningTargets.isActive, true),
      ),
    )
    .limit(1);
  if (!target) {
    return null;
  }

  const [created] = await db
    .insert(cleaningRecords)
    .values({ catId, cleaningTargetId, ...toValues(data) })
    .returning({ id: cleaningRecords.id });
  return created.id;
}

/** 猫の掃除対象の記録を更新する。見つからなければ false */
export async function updateCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  id: string,
  data: CleaningRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(cleaningRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(
      and(
        eq(cleaningRecords.id, id),
        eq(cleaningRecords.catId, catId),
        eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
      ),
    )
    .returning({ id: cleaningRecords.id });
  return result.length > 0;
}
