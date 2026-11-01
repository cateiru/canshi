import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brushingRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { BrushingRecordFormInput } from "./schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: BrushingRecordFormInput) {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    durationMinutes: data.durationMinutes ?? null,
    shedAmount: data.shedAmount ?? null,
    hasMats: data.hasMats,
    hasSkinIssue: data.hasSkinIssue,
    memo: data.memo ?? null,
  };
}

/** 記録を追加し、その ID を返す */
export async function createBrushingRecord(
  catId: string,
  data: BrushingRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(brushingRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: brushingRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateBrushingRecord(
  catId: string,
  id: string,
  data: BrushingRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(brushingRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(brushingRecords.id, id), eq(brushingRecords.catId, catId)))
    .returning({ id: brushingRecords.id });
  return result.length > 0;
}
