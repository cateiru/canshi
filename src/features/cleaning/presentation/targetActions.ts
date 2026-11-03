"use server";

import type { CleaningTarget } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createCleaningTarget,
  deleteCleaningTarget,
  updateCleaningTarget,
} from "../application/targetMutations";
import {
  type CleaningTargetFormFieldErrors,
  cleaningTargetFormSchema,
} from "../domain/targetSchema";

export type CleaningTargetFormState = SubmitRedirect & {
  fieldErrors?: CleaningTargetFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return cleaningTargetFormSchema.safeParse({
    name: formData.get("name"),
    frequencyValue: formData.get("frequencyValue"),
    frequencyUnit: formData.get("frequencyUnit"),
    isActive: formData.get("isActive"),
    notifyTime: formData.get("notifyTime"),
  });
}

export async function createCleaningTargetAction(
  catId: string,
  _prevState: CleaningTargetFormState,
  formData: FormData,
): Promise<CleaningTargetFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createCleaningTarget(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/cleaning` };
}

/**
 * 初回利用時のプリセット（猫砂・おしっこシート）をワンタップで追加する
 */
export async function createCleaningTargetFromPresetAction(
  catId: string,
  name: string,
  frequencyValue: number,
  frequencyUnit: CleaningTarget["frequencyUnit"],
): Promise<SubmitRedirect> {
  await requireCatAccess(catId);
  await createCleaningTarget(catId, {
    name,
    frequencyValue,
    frequencyUnit,
    isActive: true,
  });

  return { redirectTo: `/cats/${catId}/cleaning` };
}

export async function updateCleaningTargetAction(
  catId: string,
  id: string,
  _prevState: CleaningTargetFormState,
  formData: FormData,
): Promise<CleaningTargetFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateCleaningTarget(catId, id, parsed.data))) {
    return { formError: "掃除対象が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/cleaning` };
}

export async function deleteCleaningTargetAction(
  catId: string,
  id: string,
): Promise<SubmitRedirect> {
  await requireCatAccess(catId);
  await deleteCleaningTarget(catId, id);
  return { redirectTo: `/cats/${catId}/cleaning` };
}
