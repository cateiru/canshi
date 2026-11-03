"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createShampooRecord,
  deleteShampooRecord,
  updateShampooRecord,
} from "./mutations";
import {
  type ShampooRecordFormFieldErrors,
  shampooRecordFormSchema,
} from "./schema";

export type ShampooRecordFormState = SubmitRedirect & {
  fieldErrors?: ShampooRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return shampooRecordFormSchema.safeParse({
    performedDate: formData.get("performedDate"),
    performedTime: formData.get("performedTime"),
    memo: formData.get("memo"),
  });
}

export async function createShampooRecordAction(
  catId: string,
  _prevState: ShampooRecordFormState,
  formData: FormData,
): Promise<ShampooRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createShampooRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/shampoo-records` };
}

export async function updateShampooRecordAction(
  catId: string,
  id: string,
  _prevState: ShampooRecordFormState,
  formData: FormData,
): Promise<ShampooRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateShampooRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/shampoo-records` };
}

export async function deleteShampooRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  await deleteShampooRecord(catId, id);
  redirect(`/cats/${catId}/shampoo-records`, "replace");
}
