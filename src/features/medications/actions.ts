"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  hospitalVisits,
  medicationDoses,
  medications,
  symptoms,
} from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { MEDICATION_MEDIA_TYPE } from "./media";
import { type MedicationFormFieldErrors, medicationFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type MedicationFormState = MediaFormState & {
  fieldErrors?: MedicationFormFieldErrors;
};

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

function parseFormData(formData: FormData) {
  return medicationFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    name: formData.get("name"),
    doseAmount: formData.get("doseAmount"),
    dosesPerDay: formData.get("dosesPerDay"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    hospitalVisitId: formData.get("hospitalVisitId"),
  });
}

export async function createMedicationAction(
  catId: string,
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (
    !(await verifyReferencesBelongToCat(
      db,
      {
        symptomId: parsed.data.symptomId,
        hospitalVisitId: parsed.data.hospitalVisitId,
      },
      catId,
    ))
  ) {
    return { formError: "関連する症状・通院記録が見つかりませんでした" };
  }

  const [created] = await db
    .insert(medications)
    .values({
      catId,
      symptomId: parsed.data.symptomId ?? null,
      name: parsed.data.name,
      doseAmount: parsed.data.doseAmount,
      dosesPerDay: parsed.data.dosesPerDay,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      hospitalVisitId: parsed.data.hospitalVisitId ?? null,
    })
    .returning({ id: medications.id });

  return { savedRecordId: created.id };
}

export async function updateMedicationAction(
  catId: string,
  id: string,
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (
    !(await verifyReferencesBelongToCat(
      db,
      {
        symptomId: parsed.data.symptomId,
        hospitalVisitId: parsed.data.hospitalVisitId,
      },
      catId,
    ))
  ) {
    return { formError: "関連する症状・通院記録が見つかりませんでした" };
  }

  const result = await db
    .update(medications)
    .set({
      symptomId: parsed.data.symptomId ?? null,
      name: parsed.data.name,
      doseAmount: parsed.data.doseAmount,
      dosesPerDay: parsed.data.dosesPerDay,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      hospitalVisitId: parsed.data.hospitalVisitId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(medications.id, id), eq(medications.catId, catId)))
    .returning({ id: medications.id });

  if (result.length === 0) {
    return { formError: "服薬予定が見つかりませんでした" };
  }

  return { savedRecordId: id };
}

export async function deleteMedicationAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
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
  redirect(`/cats/${catId}/medications`);
}
