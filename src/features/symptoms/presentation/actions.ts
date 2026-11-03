"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import { syncRecordMediaFromForm } from "@/features/media/presentation/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import {
  createSymptom,
  deleteSymptom,
  updateSymptom,
} from "../application/mutations";
import { SYMPTOM_MEDIA_TYPE } from "../domain/media";
import {
  type SymptomFormFieldErrors,
  symptomFormSchema,
} from "../domain/schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真・動画はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type SymptomFormState = MediaFormState & {
  fieldErrors?: SymptomFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return symptomFormSchema.safeParse({
    symptomType: formData.get("symptomType"),
    onsetDate: formData.get("onsetDate"),
    onsetTime: formData.get("onsetTime"),
    frequencyOrSeverity: formData.get("frequencyOrSeverity"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    status: formData.get("status"),
    hospitalVisitId: formData.get("hospitalVisitId"),
    memo: formData.get("memo"),
  });
}

export async function createSymptomAction(
  catId: string,
  _prevState: SymptomFormState,
  formData: FormData,
): Promise<SymptomFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await createSymptom(catId, parsed.data);
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    SYMPTOM_MEDIA_TYPE,
    saved.id,
    formData,
  );
  return { savedRecordId: saved.id, formError: mediaError };
}

export async function updateSymptomAction(
  catId: string,
  id: string,
  _prevState: SymptomFormState,
  formData: FormData,
): Promise<SymptomFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await updateSymptom(catId, id, parsed.data);
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    SYMPTOM_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteSymptomAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  await deleteSymptom(catId, id);
  redirect(`/cats/${catId}/symptoms`, "replace");
}
