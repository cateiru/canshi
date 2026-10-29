import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { medicationDoses, medications } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { MedicationDoseFormInput } from "./doseSchema";

/*
 * 投薬実績の保存。画面（`./doseActions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

function toValues(data: MedicationDoseFormInput) {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    wasAdministered: data.wasAdministered,
    memo: data.memo ?? null,
  };
}

/**
 * 投薬実績を追加し、その ID を返す。服薬予定が猫のものでなければ null。
 * 服薬予定の ID は URL・AI から任意の値を渡せるため、他猫の服薬予定に投薬実績が
 * 紐付いてしまうのを防ぐ
 */
export async function createMedicationDose(
  catId: string,
  medicationId: string,
  data: MedicationDoseFormInput,
  d1?: D1Database,
): Promise<string | null> {
  const db = getDb(d1);
  const [medication] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(and(eq(medications.id, medicationId), eq(medications.catId, catId)))
    .limit(1);
  if (!medication) {
    return null;
  }

  const [created] = await db
    .insert(medicationDoses)
    .values({ catId, medicationId, ...toValues(data) })
    .returning({ id: medicationDoses.id });
  return created.id;
}

/** 猫の服薬予定の投薬実績を更新する。見つからなければ false */
export async function updateMedicationDose(
  catId: string,
  medicationId: string,
  id: string,
  data: MedicationDoseFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(medicationDoses)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(
      and(
        eq(medicationDoses.id, id),
        eq(medicationDoses.catId, catId),
        eq(medicationDoses.medicationId, medicationId),
      ),
    )
    .returning({ id: medicationDoses.id });
  return result.length > 0;
}
