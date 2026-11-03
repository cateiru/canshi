"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/session";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "./media";
import {
  createHospitalVisit,
  deleteHospitalVisit,
  updateHospitalVisit,
} from "./mutations";
import {
  type HospitalVisitFormFieldErrors,
  hospitalVisitFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type HospitalVisitFormState = MediaFormState & {
  fieldErrors?: HospitalVisitFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return hospitalVisitFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    visitedDate: formData.get("visitedDate"),
    visitedTime: formData.get("visitedTime"),
    reason: formData.get("reason"),
    expenseAmountYen: formData.get("expenseAmountYen"),
    linkExpenseRecordId: formData.get("linkExpenseRecordId"),
    diagnosis: formData.get("diagnosis"),
    examinationResults: formData.get("examinationResults"),
    treatment: formData.get("treatment"),
    nextVisitDate: formData.get("nextVisitDate"),
    nextVisitTime: formData.get("nextVisitTime"),
    memo: formData.get("memo"),
  });
}

export async function createHospitalVisitAction(
  catId: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const { cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照）
  const saved = await createHospitalVisit(
    { id: catId, householdId: cat.householdId as string },
    parsed.data,
  );
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    HOSPITAL_VISIT_MEDIA_TYPE,
    saved.id,
    formData,
  );
  return { savedRecordId: saved.id, formError: mediaError };
}

export async function updateHospitalVisitAction(
  catId: string,
  id: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const { cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照）
  const saved = await updateHospitalVisit(
    { id: catId, householdId: cat.householdId as string },
    id,
    parsed.data,
  );
  if ("error" in saved) {
    return { formError: saved.error };
  }

  const mediaError = await syncRecordMediaFromForm(
    HOSPITAL_VISIT_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteHospitalVisitAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  await deleteHospitalVisit(catId, id);
  redirect(`/cats/${catId}/hospital-visits`, "replace");
}
