"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { hospitalVisits, medications, symptoms } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  type HospitalVisitFormFieldErrors,
  hospitalVisitFormSchema,
} from "./schema";

export type HospitalVisitFormState = {
  fieldErrors?: HospitalVisitFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return hospitalVisitFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    reservedDate: formData.get("reservedDate"),
    reservedTime: formData.get("reservedTime"),
    visitedDate: formData.get("visitedDate"),
    visitedTime: formData.get("visitedTime"),
    reason: formData.get("reason"),
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
    reservedAt:
      data.reservedDate != null && data.reservedTime != null
        ? combineDateTimeUtc(data.reservedDate, data.reservedTime)
        : null,
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

  await db.insert(hospitalVisits).values({
    catId,
    ...buildValues(parsed.data),
  });

  redirect(`/cats/${catId}/hospital-visits`);
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

  const result = await db
    .update(hospitalVisits)
    .set({ ...buildValues(parsed.data), updatedAt: new Date() })
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .returning({ id: hospitalVisits.id });

  if (result.length === 0) {
    return { formError: "通院記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/hospital-visits`);
}

export async function deleteHospitalVisitAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // symptoms.hospital_visit_id / medications.hospital_visit_id からの外部キー
  // 参照があるため、通院記録を削除する前に紐付けを解除しておく。3つの操作は
  // db.batch でまとめて原子的に実行する
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
      .delete(hospitalVisits)
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
  ]);
  redirect(`/cats/${catId}/hospital-visits`);
}
