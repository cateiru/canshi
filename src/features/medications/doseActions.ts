"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { medicationDoses } from "@/db/schema";
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
    .where(eq(medicationDoses.id, id))
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
  await db.delete(medicationDoses).where(eq(medicationDoses.id, id));
  redirect(`/cats/${catId}/medications/${medicationId}/doses`);
}
