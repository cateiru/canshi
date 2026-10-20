import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { VomitRecordFormInput } from "./schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
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
