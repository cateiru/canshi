"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cats, feedingRecords, poopRecords } from "@/db/schema";
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
  // 各記録テーブルは cats.id への外部キー制約（ON DELETE no action）を持つため、
  // 猫本体より先に紐づく記録を削除しておく
  await db.delete(feedingRecords).where(eq(feedingRecords.catId, id));
  await db.delete(poopRecords).where(eq(poopRecords.catId, id));
  await db.delete(cats).where(eq(cats.id, id));
  redirect("/cats");
}
