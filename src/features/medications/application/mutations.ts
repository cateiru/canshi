import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  hospitalVisits,
  medicationDoses,
  medications,
  symptoms,
} from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import { MEDICATION_MEDIA_TYPE } from "../domain/media";
import type { MedicationFormInput } from "../domain/schema";

/*
 * 服薬予定の保存。猫を参照できるかは呼び出し側で確かめる。
 * ほかの記録の mutations と揃えて、D1 は引数でも受け取れるようにする
 */

export const MEDICATION_REFERENCE_NOT_FOUND_ERROR =
  "関連する症状・通院記録が見つかりませんでした";

export type SaveMedicationResult = { id: string } | { error: string };

async function verifyReferencesBelongToCat(
  db: ReturnType<typeof getDb>,
  refs: { symptomId?: string; hospitalVisitId?: string },
  catId: string,
): Promise<boolean> {
  if (refs.symptomId != null) {
    const [row] = await db
      .select({ id: symptoms.id })
      .from(symptoms)
      .where(and(eq(symptoms.id, refs.symptomId), eq(symptoms.catId, catId)))
      .limit(1);
    if (!row) {
      return false;
    }
  }
  if (refs.hospitalVisitId != null) {
    const [row] = await db
      .select({ id: hospitalVisits.id })
      .from(hospitalVisits)
      .where(
        and(
          eq(hospitalVisits.id, refs.hospitalVisitId),
          eq(hospitalVisits.catId, catId),
        ),
      )
      .limit(1);
    if (!row) {
      return false;
    }
  }
  return true;
}

function toValues(data: MedicationFormInput) {
  return {
    symptomId: data.symptomId ?? null,
    name: data.name,
    doseAmount: data.doseAmount,
    dosesPerDay: data.dosesPerDay,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    hospitalVisitId: data.hospitalVisitId ?? null,
  };
}

/**
 * 服薬予定を追加し、その ID を返す。関連する症状・通院記録がこの猫のものでなければ
 * 追加せずにエラーを返す
 */
export async function createMedication(
  catId: string,
  data: MedicationFormInput,
  d1?: D1Database,
): Promise<SaveMedicationResult> {
  const db = getDb(d1);
  if (!(await verifyReferencesBelongToCat(db, data, catId))) {
    return { error: MEDICATION_REFERENCE_NOT_FOUND_ERROR };
  }

  const [created] = await db
    .insert(medications)
    .values({ catId, ...toValues(data) })
    .returning({ id: medications.id });
  return { id: created.id };
}

/**
 * 猫の服薬予定を更新する。関連する症状・通院記録がこの猫のものでなければ
 * 更新せずにエラーを、服薬予定が見つからなければ null を返す
 */
export async function updateMedication(
  catId: string,
  id: string,
  data: MedicationFormInput,
  d1?: D1Database,
): Promise<SaveMedicationResult | null> {
  const db = getDb(d1);
  if (!(await verifyReferencesBelongToCat(db, data, catId))) {
    return { error: MEDICATION_REFERENCE_NOT_FOUND_ERROR };
  }

  const result = await db
    .update(medications)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(medications.id, id), eq(medications.catId, catId)))
    .returning({ id: medications.id });
  return result.length > 0 ? { id } : null;
}

/**
 * 猫の服薬予定を、投薬実績と紐付く写真（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deleteMedication(
  catId: string,
  id: string,
): Promise<boolean> {
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(and(eq(medications.id, id), eq(medications.catId, catId)))
    .limit(1);
  if (!existing) return false;
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(MEDICATION_MEDIA_TYPE, id);
  // medication_doses から medications への外部キー制約があるため投薬実績も同時に削除する。
  // 2つの delete の間に別リクエストが割り込まないよう、D1 の batch で原子的に実行する
  await db.batch([
    db
      .delete(medicationDoses)
      .where(
        and(
          eq(medicationDoses.medicationId, id),
          eq(medicationDoses.catId, catId),
        ),
      ),
    db
      .delete(medications)
      .where(and(eq(medications.id, id), eq(medications.catId, catId))),
  ]);
  return true;
}

/**
 * 服薬予定を手動で服薬歴に移す（`archived` が true）、または服薬予定に戻す（false）
 */
export async function setMedicationArchived(
  catId: string,
  id: string,
  archived: boolean,
  d1?: D1Database,
): Promise<void> {
  // 発生日時と同じく、JST の見た目の数字を UTC として保存する（src/features/shared/datetime.ts）
  const archivedAt = archived ? getNaiveUtcNow() : null;
  await getDb(d1)
    .update(medications)
    .set({ archivedAt, updatedAt: new Date() })
    .where(and(eq(medications.id, id), eq(medications.catId, catId)));
}
