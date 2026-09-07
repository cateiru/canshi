"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { medications, symptoms } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { type SymptomFormFieldErrors, symptomFormSchema } from "./schema";

export type SymptomFormState = {
  fieldErrors?: SymptomFormFieldErrors;
  formError?: string;
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
  await db.insert(symptoms).values({
    catId,
    symptomType: parsed.data.symptomType,
    onsetAt: combineDateTimeUtc(parsed.data.onsetDate, parsed.data.onsetTime),
    frequencyOrSeverity: parsed.data.frequencyOrSeverity ?? null,
    appetiteNote: parsed.data.appetiteNote ?? null,
    energyNote: parsed.data.energyNote ?? null,
    status: parsed.data.status,
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/symptoms`);
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
  const result = await db
    .update(symptoms)
    .set({
      symptomType: parsed.data.symptomType,
      onsetAt: combineDateTimeUtc(parsed.data.onsetDate, parsed.data.onsetTime),
      frequencyOrSeverity: parsed.data.frequencyOrSeverity ?? null,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      status: parsed.data.status,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .returning({ id: symptoms.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/symptoms`);
}

export async function deleteSymptomAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // medications.symptom_id からの外部キー参照があるため、症状を削除する前に
  // 参照している服薬予定の紐付けを外しておく
  await db
    .update(medications)
    .set({ symptomId: null })
    .where(and(eq(medications.symptomId, id), eq(medications.catId, catId)));
  await db
    .delete(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)));
  redirect(`/cats/${catId}/symptoms`);
}
