"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { userActor } from "@/features/shared/recordActor";
import {
  createShampooRecord,
  deleteShampooRecord,
  updateShampooRecord,
} from "../application/mutations";
import {
  type ShampooRecordFormFieldErrors,
  shampooRecordFormSchema,
} from "../domain/schema";

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
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createShampooRecord(catId, parsed.data, userActor(user));

  return { redirectTo: `/cats/${catId}/shampoo-records` };
}

export async function updateShampooRecordAction(
  catId: string,
  id: string,
  _prevState: ShampooRecordFormState,
  formData: FormData,
): Promise<ShampooRecordFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateShampooRecord(catId, id, parsed.data, userActor(user)))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/shampoo-records` };
}

export async function deleteShampooRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteShampooRecord(catId, id, userActor(user));
  redirect(`/cats/${catId}/shampoo-records`, "replace");
}
