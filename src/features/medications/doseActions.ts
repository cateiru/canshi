"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { medicationDoses, medications } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  type MedicationDoseFormFieldErrors,
  medicationDoseFormSchema,
} from "./doseSchema";

export type MedicationDoseFormState = {
  fieldErrors?: MedicationDoseFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return medicationDoseFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    wasAdministered: formData.get("wasAdministered"),
    memo: formData.get("memo"),
  });
}

export async function createMedicationDoseAction(
  catId: string,
  medicationId: string,
  _prevState: MedicationDoseFormState,
  formData: FormData,
): Promise<MedicationDoseFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  // medicationId が catId に属することを確認してから登録する
  // （URL の medicationId が改ざんされ、他猫の服薬予定に投薬実績が
  // 紐付いてしまうのを防ぐ）
  const [medication] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(and(eq(medications.id, medicationId), eq(medications.catId, catId)))
    .limit(1);

  if (!medication) {
    return { formError: "服薬予定が見つかりませんでした" };
  }

  await db.insert(medicationDoses).values({
    catId,
    medicationId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    wasAdministered: parsed.data.wasAdministered,
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/medications/${medicationId}/doses`);
}

export async function updateMedicationDoseAction(
  catId: string,
  medicationId: string,
  id: string,
  _prevState: MedicationDoseFormState,
  formData: FormData,
): Promise<MedicationDoseFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(medicationDoses)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      wasAdministered: parsed.data.wasAdministered,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(medicationDoses.id, id),
        eq(medicationDoses.catId, catId),
        eq(medicationDoses.medicationId, medicationId),
      ),
    )
    .returning({ id: medicationDoses.id });

  if (result.length === 0) {
    return { formError: "投薬実績が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/medications/${medicationId}/doses`);
}

export async function deleteMedicationDoseAction(
  catId: string,
  medicationId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(medicationDoses)
    .where(
      and(
        eq(medicationDoses.id, id),
        eq(medicationDoses.catId, catId),
        eq(medicationDoses.medicationId, medicationId),
      ),
    );
  redirect(`/cats/${catId}/medications/${medicationId}/doses`);
}
