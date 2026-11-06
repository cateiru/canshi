"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import { syncRecordMediaFromForm } from "@/features/media/presentation/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import { userActor } from "@/features/shared/recordActor";
import {
  createVomitRecord,
  deleteVomitRecord,
  updateVomitRecord,
} from "../application/mutations";
import { VOMIT_RECORD_MEDIA_TYPE } from "../domain/media";
import {
  type VomitRecordFormFieldErrors,
  vomitRecordFormSchema,
} from "../domain/schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type VomitRecordFormState = MediaFormState & {
  fieldErrors?: VomitRecordFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return vomitRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    amount: formData.get("amount"),
    color: formData.get("color"),
    hasBlood: formData.get("hasBlood"),
    hasForeignObject: formData.get("hasForeignObject"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    memo: formData.get("memo"),
  });
}

export async function createVomitRecordAction(
  catId: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const id = await createVomitRecord(catId, parsed.data, userActor(user));

  const mediaError = await syncRecordMediaFromForm(
    VOMIT_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updateVomitRecordAction(
  catId: string,
  id: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateVomitRecord(catId, id, parsed.data, userActor(user)))) {
    return { formError: "記録が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    VOMIT_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteVomitRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteVomitRecord(catId, id, userActor(user));
  redirect(`/cats/${catId}/vomit-records`, "replace");
}
