"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { type PoopRecordFormFieldErrors, poopRecordFormSchema } from "./schema";

export type PoopRecordFormState = {
  fieldErrors?: PoopRecordFormFieldErrors;
  formError?: string;
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
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(poopRecords).values({
    catId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    amount: parsed.data.amount ?? null,
    color: parsed.data.color ?? null,
    consistency: parsed.data.consistency,
    hasBlood: parsed.data.hasBlood,
    hasForeignObject: parsed.data.hasForeignObject,
    appetiteNote: parsed.data.appetiteNote ?? null,
    energyNote: parsed.data.energyNote ?? null,
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/poop-records`);
}

export async function updatePoopRecordAction(
  catId: string,
  id: string,
  _prevState: PoopRecordFormState,
  formData: FormData,
): Promise<PoopRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(poopRecords)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      amount: parsed.data.amount ?? null,
      color: parsed.data.color ?? null,
      consistency: parsed.data.consistency,
      hasBlood: parsed.data.hasBlood,
      hasForeignObject: parsed.data.hasForeignObject,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
    .returning({ id: poopRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/poop-records`);
}

export async function deletePoopRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(poopRecords)
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)));
  redirect(`/cats/${catId}/poop-records`);
}
