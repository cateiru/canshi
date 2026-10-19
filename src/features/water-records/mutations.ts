import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { waterRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateEstimatedIntakeMl } from "./calculations";
import type { WaterRecordFormInput } from "./schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: WaterRecordFormInput) {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    measurementMethod: data.measurementMethod,
    suppliedAmountMl: data.suppliedAmountMl,
    remainingAmountMl: data.remainingAmountMl ?? null,
    estimatedIntakeMl: calculateEstimatedIntakeMl(
      data.suppliedAmountMl,
      data.remainingAmountMl,
    ),
    hasSpill: data.hasSpill,
    wasWaterChanged: data.wasWaterChanged,
    subjectiveAmount: data.subjectiveAmount ?? null,
    memo: data.memo ?? null,
  };
}

/** 記録を追加し、その ID を返す */
export async function createWaterRecord(
  catId: string,
  data: WaterRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(waterRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: waterRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateWaterRecord(
  catId: string,
  id: string,
  data: WaterRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(waterRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(waterRecords.id, id), eq(waterRecords.catId, catId)))
    .returning({ id: waterRecords.id });
  return result.length > 0;
}
