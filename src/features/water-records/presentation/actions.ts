"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { userActor } from "@/features/shared/recordActor";
import {
  createWaterRecord,
  deleteWaterRecord,
  updateWaterRecord,
} from "../application/mutations";
import {
  type WaterRecordFormFieldErrors,
  waterRecordFormSchema,
} from "../domain/schema";

export type WaterRecordFormState = SubmitRedirect & {
  fieldErrors?: WaterRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return waterRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    measurementMethod: formData.get("measurementMethod"),
    suppliedAmountMl: formData.get("suppliedAmountMl"),
    remainingAmountMl: formData.get("remainingAmountMl"),
    hasSpill: formData.get("hasSpill"),
    wasWaterChanged: formData.get("wasWaterChanged"),
    subjectiveAmount: formData.get("subjectiveAmount"),
    memo: formData.get("memo"),
  });
}

export async function createWaterRecordAction(
  catId: string,
  _prevState: WaterRecordFormState,
  formData: FormData,
): Promise<WaterRecordFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createWaterRecord(catId, parsed.data, userActor(user));

  return { redirectTo: `/cats/${catId}/water-records` };
}

export async function updateWaterRecordAction(
  catId: string,
  id: string,
  _prevState: WaterRecordFormState,
  formData: FormData,
): Promise<WaterRecordFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateWaterRecord(catId, id, parsed.data, userActor(user)))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/water-records` };
}

export async function deleteWaterRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteWaterRecord(catId, id, userActor(user));
  redirect(`/cats/${catId}/water-records`, "replace");
}
