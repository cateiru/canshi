"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  expenseRecords,
  hospitalVisits,
  medications,
  symptoms,
} from "@/db/schema";
import { saveHospitalVisitWithExpense } from "@/features/expenses/hospitalVisitExpense";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "./media";
import {
  type HospitalVisitFormFieldErrors,
  hospitalVisitFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type HospitalVisitFormState = MediaFormState & {
  fieldErrors?: HospitalVisitFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return hospitalVisitFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    visitedDate: formData.get("visitedDate"),
    visitedTime: formData.get("visitedTime"),
    reason: formData.get("reason"),
    expenseAmountYen: formData.get("expenseAmountYen"),
    diagnosis: formData.get("diagnosis"),
    examinationResults: formData.get("examinationResults"),
    treatment: formData.get("treatment"),
    nextVisitDate: formData.get("nextVisitDate"),
    nextVisitTime: formData.get("nextVisitTime"),
    memo: formData.get("memo"),
  });
}

async function verifySymptomBelongsToCat(
  db: ReturnType<typeof getDb>,
  symptomId: string | undefined,
  catId: string,
): Promise<boolean> {
  if (symptomId == null) {
    return true;
  }
  const [row] = await db
    .select({ id: symptoms.id })
    .from(symptoms)
    .where(and(eq(symptoms.id, symptomId), eq(symptoms.catId, catId)))
    .limit(1);
  return row != null;
}

function buildValues(data: ReturnType<typeof hospitalVisitFormSchema.parse>) {
  return {
    symptomId: data.symptomId ?? null,
    visitedAt: combineDateTimeUtc(data.visitedDate, data.visitedTime),
    reason: data.reason,
    diagnosis: data.diagnosis ?? null,
    examinationResults: data.examinationResults ?? null,
    treatment: data.treatment ?? null,
    nextVisitAt:
      data.nextVisitDate != null && data.nextVisitTime != null
        ? combineDateTimeUtc(data.nextVisitDate, data.nextVisitTime)
        : null,
    memo: data.memo ?? null,
  };
}

export async function createHospitalVisitAction(
  catId: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (!(await verifySymptomBelongsToCat(db, parsed.data.symptomId, catId))) {
    return { formError: "関連する症状が見つかりませんでした" };
  }

  const values = buildValues(parsed.data);
  const id = crypto.randomUUID();
  await saveHospitalVisitWithExpense(
    db,
    db.insert(hospitalVisits).values({ id, catId, ...values }),
    {
      hospitalVisitId: id,
      catId,
      visitedAt: values.visitedAt,
      amountYen: parsed.data.expenseAmountYen ?? null,
    },
  );

  return { savedRecordId: id };
}

export async function updateHospitalVisitAction(
  catId: string,
  id: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (!(await verifySymptomBelongsToCat(db, parsed.data.symptomId, catId))) {
    return { formError: "関連する症状が見つかりませんでした" };
  }

  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);

  if (!existing) {
    return { formError: "通院記録が見つかりませんでした" };
  }

  const values = buildValues(parsed.data);
  await saveHospitalVisitWithExpense(
    db,
    db
      .update(hospitalVisits)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
    {
      hospitalVisitId: id,
      catId,
      visitedAt: values.visitedAt,
      amountYen: parsed.data.expenseAmountYen ?? null,
    },
  );

  return { savedRecordId: id };
}

export async function deleteHospitalVisitAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/hospital-visits`);
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(HOSPITAL_VISIT_MEDIA_TYPE, id);
  // symptoms.hospital_visit_id / medications.hospital_visit_id /
  // expense_records.hospital_visit_id からの外部キー参照があるため、通院記録を
  // 削除する前に紐付けを解除しておく。支出記録は家計簿として残す必要があるため、
  // 紐付けだけ外して記録自体は削除しない。一連の操作は db.batch でまとめて
  // 原子的に実行する
  await db.batch([
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(and(eq(symptoms.hospitalVisitId, id), eq(symptoms.catId, catId))),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(
        and(eq(medications.hospitalVisitId, id), eq(medications.catId, catId)),
      ),
    db
      .update(expenseRecords)
      .set({ hospitalVisitId: null })
      .where(eq(expenseRecords.hospitalVisitId, id)),
    db
      .delete(hospitalVisits)
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
  ]);
  redirect(`/cats/${catId}/hospital-visits`);
}
