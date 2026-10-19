import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { PoopRecordFormInput } from "./schema";

/*
 * うんちの記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
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
