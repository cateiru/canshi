"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import { syncRecordMediaFromForm } from "@/features/media/application/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import {
  createPoopRecord,
  deletePoopRecord,
  updatePoopRecord,
} from "../application/mutations";
import { POOP_RECORD_MEDIA_TYPE } from "../domain/media";
import {
  type PoopRecordFormFieldErrors,
  poopRecordFormSchema,
} from "../domain/schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type PoopRecordFormState = MediaFormState & {
  fieldErrors?: PoopRecordFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return poopRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    amount: formData.get("amount"),
    color: formData.get("color"),
    consistency: formData.get("consistency"),
    hasBlood: formData.get("hasBlood"),
    hasForeignObject: formData.get("hasForeignObject"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    memo: formData.get("memo"),
  });
}

export async function createPoopRecordAction(
  catId: string,
  _prevState: PoopRecordFormState,
  formData: FormData,
): Promise<PoopRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const id = await createPoopRecord(catId, parsed.data);

  const mediaError = await syncRecordMediaFromForm(
    POOP_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updatePoopRecordAction(
  catId: string,
  id: string,
  _prevState: PoopRecordFormState,
  formData: FormData,
): Promise<PoopRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updatePoopRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    POOP_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deletePoopRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  await deletePoopRecord(catId, id);
  redirect(`/cats/${catId}/poop-records`, "replace");
}
