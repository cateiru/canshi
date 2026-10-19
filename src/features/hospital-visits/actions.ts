"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  expenseRecordHospitalVisits,
  hospitalVisits,
  medications,
  symptoms,
} from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "./media";
import { createHospitalVisit, updateHospitalVisit } from "./mutations";
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
  const db = getDb();
  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/hospital-visits`, "replace");
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(HOSPITAL_VISIT_MEDIA_TYPE, id);
  // symptoms.hospital_visit_id / medications.hospital_visit_id /
  // expense_record_hospital_visits からの外部キー参照があるため、通院記録を
  // 削除する前に紐付けを解除しておく。支出記録は家計簿として残す必要があるため、
  // 紐付けだけ外して記録自体は削除しない。一連の操作は db.batch でまとめて
  // 原子的に実行する
  await db.batch([
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(and(eq(symptoms.hospitalVisitId, id), eq(symptoms.catId, catId))),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(
        and(eq(medications.hospitalVisitId, id), eq(medications.catId, catId)),
      ),
    db
      .delete(expenseRecordHospitalVisits)
      .where(eq(expenseRecordHospitalVisits.hospitalVisitId, id)),
    db
      .delete(hospitalVisits)
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
  ]);
  redirect(`/cats/${catId}/hospital-visits`, "replace");
}
