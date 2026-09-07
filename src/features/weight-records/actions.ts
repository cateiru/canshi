"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { weightRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateCatWeightKg } from "./calculations";
import {
  type WeightRecordFormFieldErrors,
  weightRecordFormSchema,
} from "./schema";

export type WeightRecordFormState = {
  fieldErrors?: WeightRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return weightRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    inputMethod: formData.get("inputMethod"),
    combinedWeightKg: formData.get("combinedWeightKg"),
    humanWeightKg: formData.get("humanWeightKg"),
    catWeightKg: formData.get("catWeightKg"),
  });
}

function resolveCatWeightKg(data: {
  inputMethod: "auto" | "direct";
  combinedWeightKg?: number;
  humanWeightKg?: number;
  catWeightKg?: number;
}): number {
  if (data.inputMethod === "auto") {
    // フォームのバリデーションで両方の値が存在することを保証済み
    return calculateCatWeightKg(
      data.combinedWeightKg as number,
      data.humanWeightKg as number,
    );
  }
  return data.catWeightKg as number;
}

export async function createWeightRecordAction(
  catId: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(weightRecords).values({
    catId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    inputMethod: parsed.data.inputMethod,
    combinedWeightKg: parsed.data.combinedWeightKg ?? null,
    humanWeightKg: parsed.data.humanWeightKg ?? null,
    catWeightKg: resolveCatWeightKg(parsed.data),
  });

  redirect(`/cats/${catId}/weight-records`);
}

export async function updateWeightRecordAction(
  catId: string,
  id: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(weightRecords)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      inputMethod: parsed.data.inputMethod,
      combinedWeightKg: parsed.data.combinedWeightKg ?? null,
      humanWeightKg: parsed.data.humanWeightKg ?? null,
      catWeightKg: resolveCatWeightKg(parsed.data),
      updatedAt: new Date(),
    })
    .where(and(eq(weightRecords.id, id), eq(weightRecords.catId, catId)))
    .returning({ id: weightRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/weight-records`);
}

export async function deleteWeightRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(weightRecords)
    .where(and(eq(weightRecords.id, id), eq(weightRecords.catId, catId)));
  redirect(`/cats/${catId}/weight-records`);
}
