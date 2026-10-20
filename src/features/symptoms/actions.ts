"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  hospitalVisits,
  medications,
  notifications,
  symptoms,
} from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { SYMPTOM_MEDIA_TYPE } from "./media";
import { createSymptom, updateSymptom } from "./mutations";
import { type SymptomFormFieldErrors, symptomFormSchema } from "./schema";

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
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: symptoms.id })
    .from(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/symptoms`, "replace");
  // 紐付く写真・動画（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(SYMPTOM_MEDIA_TYPE, id);
  // medications.symptom_id / hospital_visits.symptom_id からの外部キー参照が
  // あるため、症状を削除する前に参照している側の紐付けを外しておく。
  // notifications の reference_id もこの症状を指しうる（`symptom_ongoing`）ため、
  // 確認通知もあわせて削除する。操作の間に別リクエストが割り込まないよう
  // db.batch でまとめて原子的に実行する
  await db.batch([
    db
      .update(medications)
      .set({ symptomId: null, updatedAt: new Date() })
      .where(and(eq(medications.symptomId, id), eq(medications.catId, catId))),
    db
      .update(hospitalVisits)
      .set({ symptomId: null })
      .where(
        and(eq(hospitalVisits.symptomId, id), eq(hospitalVisits.catId, catId)),
      ),
    db
      .delete(notifications)
      .where(
        and(
          eq(notifications.kind, "symptom_ongoing"),
          eq(notifications.referenceId, id),
          eq(notifications.catId, catId),
        ),
      ),
    db
      .delete(symptoms)
      .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId))),
  ]);
  redirect(`/cats/${catId}/symptoms`, "replace");
}
