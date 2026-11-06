"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { userActor } from "@/features/shared/recordActor";
import {
  createMedicationDose,
  deleteMedicationDose,
  updateMedicationDose,
} from "../application/doseMutations";
import {
  type MedicationDoseFormFieldErrors,
  medicationDoseFormSchema,
} from "../domain/doseSchema";

export type MedicationDoseFormState = SubmitRedirect & {
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
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (
    !(await createMedicationDose(
      catId,
      medicationId,
      parsed.data,
      userActor(user),
    ))
  ) {
    return { formError: "服薬予定が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/medications/${medicationId}/doses` };
}

export async function updateMedicationDoseAction(
  catId: string,
  medicationId: string,
  id: string,
  _prevState: MedicationDoseFormState,
  formData: FormData,
): Promise<MedicationDoseFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (
    !(await updateMedicationDose(
      catId,
      medicationId,
      id,
      parsed.data,
      userActor(user),
    ))
  ) {
    return { formError: "投薬実績が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/medications/${medicationId}/doses` };
}

export async function deleteMedicationDoseAction(
  catId: string,
  medicationId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteMedicationDose(catId, medicationId, id, userActor(user));
  redirect(`/cats/${catId}/medications/${medicationId}/doses`, "replace");
}
