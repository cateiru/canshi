import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { weightRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateCatWeightKg } from "./calculations";
import type { WeightRecordFormInput } from "./schema";

/*
 * 記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function resolveCatWeightKg(data: WeightRecordFormInput): number {
  if (data.inputMethod === "auto") {
    // フォームのバリデーションで両方の値が存在することを保証済み
    return calculateCatWeightKg(
      data.combinedWeightKg as number,
      data.humanWeightKg as number,
    );
  }
  return data.catWeightKg as number;
}

function toValues(data: WeightRecordFormInput) {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    inputMethod: data.inputMethod,
    combinedWeightKg: data.combinedWeightKg ?? null,
    humanWeightKg: data.humanWeightKg ?? null,
    catWeightKg: resolveCatWeightKg(data),
    bcs: data.bcs ?? null,
  };
}

/** 記録を追加し、その ID を返す */
export async function createWeightRecord(
  catId: string,
  data: WeightRecordFormInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(weightRecords)
    .values({ catId, ...toValues(data) })
    .returning({ id: weightRecords.id });
  return created.id;
}

/** 猫の記録を更新する。見つからなければ false */
export async function updateWeightRecord(
  catId: string,
  id: string,
  data: WeightRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(weightRecords)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(weightRecords.id, id), eq(weightRecords.catId, catId)))
    .returning({ id: weightRecords.id });
  return result.length > 0;
}
