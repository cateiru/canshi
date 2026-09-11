"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  catPhotos,
  cats,
  feedingRecords,
  hospitalVisits,
  medicationDoses,
  medications,
  poopRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import { deleteMediaAssetsByCat } from "@/features/media/storage";
import { type CatFormFieldErrors, catFormSchema } from "./schema";

export type CatFormState = {
  fieldErrors?: CatFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return catFormSchema.safeParse({
    name: formData.get("name"),
    sex: formData.get("sex"),
    birthDate: formData.get("birthDate"),
    breed: formData.get("breed"),
    adoptedAt: formData.get("adoptedAt"),
  });
}

export async function createCatAction(
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [created] = await db
    .insert(cats)
    .values({
      name: parsed.data.name,
      sex: parsed.data.sex,
      birthDate: parsed.data.birthDate ?? null,
      breed: parsed.data.breed ?? null,
      adoptedAt: parsed.data.adoptedAt ?? null,
    })
    .returning({ id: cats.id });

  redirect(`/cats/${created.id}`);
}

export async function updateCatAction(
  id: string,
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(cats)
    .set({
      name: parsed.data.name,
      sex: parsed.data.sex,
      birthDate: parsed.data.birthDate ?? null,
      breed: parsed.data.breed ?? null,
      adoptedAt: parsed.data.adoptedAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(cats.id, id))
    .returning({ id: cats.id });

  if (result.length === 0) {
    return { formError: "猫が見つかりませんでした" };
  }

  redirect(`/cats/${id}`);
}

export async function deleteCatAction(id: string): Promise<void> {
  const db = getDb();
  // media_assets.cat_id が cats.id を参照しているため、猫に紐付くメディア（R2 のオブジェクトと行）を
  // 先に削除する。R2 の削除に失敗した場合はここで例外になり、猫と記録は残る
  await deleteMediaAssetsByCat(id);
  // 各記録テーブルは cats.id への外部キー制約（ON DELETE no action）を持つため、
  // 猫本体より先に紐づく記録を削除しておく。symptoms と hospital_visits は
  // 互いを参照しうるため、削除前にまず双方の紐付け（hospital_visit_id /
  // symptom_id）を解除して循環を断ち切る。medications.symptom_id が
  // symptoms を参照しているため、medications（と、それに依存する
  // medicationDoses）は symptoms より先に削除する。途中で失敗して猫だけ残る
  // /一部の記録だけ消えるような中途半端な状態にならないよう、1つの
  // db.batch でまとめて原子的に実行する
  await db.batch([
    db.delete(feedingRecords).where(eq(feedingRecords.catId, id)),
    db.delete(poopRecords).where(eq(poopRecords.catId, id)),
    db.delete(weightRecords).where(eq(weightRecords.catId, id)),
    db.delete(vomitRecords).where(eq(vomitRecords.catId, id)),
    db.delete(waterRecords).where(eq(waterRecords.catId, id)),
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(eq(symptoms.catId, id)),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(eq(medications.catId, id)),
    db
      .update(hospitalVisits)
      .set({ symptomId: null })
      .where(eq(hospitalVisits.catId, id)),
    db.delete(hospitalVisits).where(eq(hospitalVisits.catId, id)),
    db.delete(medicationDoses).where(eq(medicationDoses.catId, id)),
    db.delete(medications).where(eq(medications.catId, id)),
    db.delete(symptoms).where(eq(symptoms.catId, id)),
    db.delete(catPhotos).where(eq(catPhotos.catId, id)),
    db.delete(cats).where(eq(cats.id, id)),
  ]);
  redirect("/cats");
}
