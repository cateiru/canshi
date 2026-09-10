"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { hospitalVisits, medications, symptoms } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { SYMPTOM_MEDIA_TYPE } from "./media";
import { type SymptomFormFieldErrors, symptomFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真・動画のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type SymptomFormState = MediaFormState & {
  fieldErrors?: SymptomFormFieldErrors;
};

async function verifyHospitalVisitBelongsToCat(
  db: ReturnType<typeof getDb>,
  hospitalVisitId: string | undefined,
  catId: string,
): Promise<boolean> {
  if (hospitalVisitId == null) {
    return true;
  }
  const [row] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(
      and(
        eq(hospitalVisits.id, hospitalVisitId),
        eq(hospitalVisits.catId, catId),
      ),
    )
    .limit(1);
  return row != null;
}

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
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (
    !(await verifyHospitalVisitBelongsToCat(
      db,
      parsed.data.hospitalVisitId,
      catId,
    ))
  ) {
    return { formError: "関連する通院記録が見つかりませんでした" };
  }

  const [created] = await db
    .insert(symptoms)
    .values({
      catId,
      symptomType: parsed.data.symptomType,
      onsetAt: combineDateTimeUtc(parsed.data.onsetDate, parsed.data.onsetTime),
      frequencyOrSeverity: parsed.data.frequencyOrSeverity ?? null,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      status: parsed.data.status,
      hospitalVisitId: parsed.data.hospitalVisitId ?? null,
      memo: parsed.data.memo ?? null,
    })
    .returning({ id: symptoms.id });

  return { savedRecordId: created.id };
}

export async function updateSymptomAction(
  catId: string,
  id: string,
  _prevState: SymptomFormState,
  formData: FormData,
): Promise<SymptomFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (
    !(await verifyHospitalVisitBelongsToCat(
      db,
      parsed.data.hospitalVisitId,
      catId,
    ))
  ) {
    return { formError: "関連する通院記録が見つかりませんでした" };
  }

  const result = await db
    .update(symptoms)
    .set({
      symptomType: parsed.data.symptomType,
      onsetAt: combineDateTimeUtc(parsed.data.onsetDate, parsed.data.onsetTime),
      frequencyOrSeverity: parsed.data.frequencyOrSeverity ?? null,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      status: parsed.data.status,
      hospitalVisitId: parsed.data.hospitalVisitId ?? null,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .returning({ id: symptoms.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { savedRecordId: id };
}

export async function deleteSymptomAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // 紐付く写真・動画（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(SYMPTOM_MEDIA_TYPE, id);
  // medications.symptom_id / hospital_visits.symptom_id からの外部キー参照が
  // あるため、症状を削除する前に参照している側の紐付けを外しておく。
  // 3つの操作の間に別リクエストが割り込まないよう db.batch でまとめて
  // 原子的に実行する
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
      .delete(symptoms)
      .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId))),
  ]);
  redirect(`/cats/${catId}/symptoms`);
}
