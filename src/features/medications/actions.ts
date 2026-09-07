"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { medicationDoses, medications } from "@/db/schema";
import { type MedicationFormFieldErrors, medicationFormSchema } from "./schema";

export type MedicationFormState = {
  fieldErrors?: MedicationFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return medicationFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    name: formData.get("name"),
    doseAmount: formData.get("doseAmount"),
    dosesPerDay: formData.get("dosesPerDay"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
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
  await db.insert(medications).values({
    catId,
    symptomId: parsed.data.symptomId ?? null,
    name: parsed.data.name,
    doseAmount: parsed.data.doseAmount,
    dosesPerDay: parsed.data.dosesPerDay,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate ?? null,
  });

  redirect(`/cats/${catId}/medications`);
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
  const result = await db
    .update(medications)
    .set({
      symptomId: parsed.data.symptomId ?? null,
      name: parsed.data.name,
      doseAmount: parsed.data.doseAmount,
      dosesPerDay: parsed.data.dosesPerDay,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(medications.id, id), eq(medications.catId, catId)))
    .returning({ id: medications.id });

  if (result.length === 0) {
    return { formError: "服薬予定が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/medications`);
}

export async function deleteMedicationAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
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
