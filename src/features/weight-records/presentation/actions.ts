"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createWeightRecord,
  deleteWeightRecord,
  updateWeightRecord,
} from "../application/mutations";
import {
  type WeightRecordFormFieldErrors,
  weightRecordFormSchema,
} from "../domain/schema";

export type WeightRecordFormState = SubmitRedirect & {
  fieldErrors?: WeightRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return weightRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    inputMethod: formData.get("inputMethod"),
    combinedWeightKg: formData.get("combinedWeightKg"),
    humanWeightKg: formData.get("humanWeightKg"),
    catWeightKg: formData.get("catWeightKg"),
    bcs: formData.get("bcs"),
  });
}

export async function createWeightRecordAction(
  catId: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createWeightRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/weight-records` };
}

export async function updateWeightRecordAction(
  catId: string,
  id: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateWeightRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/weight-records` };
}

export async function deleteWeightRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  await deleteWeightRecord(catId, id);
  redirect(`/cats/${catId}/weight-records`, "replace");
}
