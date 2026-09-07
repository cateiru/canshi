"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  type VomitRecordFormFieldErrors,
  vomitRecordFormSchema,
} from "./schema";

export type VomitRecordFormState = {
  fieldErrors?: VomitRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return vomitRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    count: formData.get("count"),
    amount: formData.get("amount"),
    color: formData.get("color"),
    hasBlood: formData.get("hasBlood"),
    hasForeignObject: formData.get("hasForeignObject"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    memo: formData.get("memo"),
  });
}

export async function createVomitRecordAction(
  catId: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(vomitRecords).values({
    catId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    count: parsed.data.count,
    amount: parsed.data.amount ?? null,
    color: parsed.data.color ?? null,
    hasBlood: parsed.data.hasBlood,
    hasForeignObject: parsed.data.hasForeignObject,
    appetiteNote: parsed.data.appetiteNote ?? null,
    energyNote: parsed.data.energyNote ?? null,
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/vomit-records`);
}

export async function updateVomitRecordAction(
  catId: string,
  id: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(vomitRecords)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      count: parsed.data.count,
      amount: parsed.data.amount ?? null,
      color: parsed.data.color ?? null,
      hasBlood: parsed.data.hasBlood,
      hasForeignObject: parsed.data.hasForeignObject,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(eq(vomitRecords.id, id))
    .returning({ id: vomitRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/vomit-records`);
}

export async function deleteVomitRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db.delete(vomitRecords).where(eq(vomitRecords.id, id));
  redirect(`/cats/${catId}/vomit-records`);
}
