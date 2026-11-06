"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import { syncRecordMediaFromForm } from "@/features/media/presentation/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import { userActor } from "@/features/shared/recordActor";
import {
  createMedication,
  deleteMedication,
  setMedicationArchived,
  updateMedication,
} from "../application/mutations";
import { MEDICATION_MEDIA_TYPE } from "../domain/media";
import {
  type MedicationFormFieldErrors,
  medicationFormSchema,
} from "../domain/schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type MedicationFormState = MediaFormState & {
  fieldErrors?: MedicationFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return medicationFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    name: formData.get("name"),
    doseAmount: formData.get("doseAmount"),
    dosesPerDay: formData.get("dosesPerDay"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    hospitalVisitId: formData.get("hospitalVisitId"),
  });
}

export async function createMedicationAction(
  catId: string,
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await createMedication(catId, parsed.data, userActor(user));
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    MEDICATION_MEDIA_TYPE,
    saved.id,
    formData,
  );
  return { savedRecordId: saved.id, formError: mediaError };
}

export async function updateMedicationAction(
  catId: string,
  id: string,
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  const { user } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await updateMedication(catId, id, parsed.data, userActor(user));
  if (!saved) {
    return { formError: "服薬予定が見つかりませんでした" };
  }
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    MEDICATION_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteMedicationAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteMedication(catId, id, userActor(user));
  redirect(`/cats/${catId}/medications`, "replace");
}

/**
 * 服薬予定を手動で服薬歴に移す。終了予定日を過ぎたものは何もしなくても服薬歴に
 * 表示されるため、ここでは飲み終わった（やめた）ものを終了予定日より前に移す
 */
export async function archiveMedicationAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await setMedicationArchived(catId, id, true, userActor(user));
  redirect(`/cats/${catId}/medications`, "replace");
}

/**
 * 手動で服薬歴に移した服薬予定を、服薬予定に戻す。終了予定日を過ぎたものは
 * 戻しても服薬歴に表示されたままになるため、終了予定日を編集してもらう
 */
export async function unarchiveMedicationAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await setMedicationArchived(catId, id, false, userActor(user));
  redirect(`/cats/${catId}/medications`, "replace");
}
