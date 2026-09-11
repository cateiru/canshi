"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { waterRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { calculateEstimatedIntakeMl } from "./calculations";
import {
  type WaterRecordFormFieldErrors,
  waterRecordFormSchema,
} from "./schema";

export type WaterRecordFormState = {
  fieldErrors?: WaterRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return waterRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    measurementMethod: formData.get("measurementMethod"),
    suppliedAmountMl: formData.get("suppliedAmountMl"),
    remainingAmountMl: formData.get("remainingAmountMl"),
    hasSpill: formData.get("hasSpill"),
    wasWaterChanged: formData.get("wasWaterChanged"),
    subjectiveAmount: formData.get("subjectiveAmount"),
    memo: formData.get("memo"),
  });
}

export async function createWaterRecordAction(
  catId: string,
  _prevState: WaterRecordFormState,
  formData: FormData,
): Promise<WaterRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(waterRecords).values({
    catId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    measurementMethod: parsed.data.measurementMethod,
    suppliedAmountMl: parsed.data.suppliedAmountMl,
    remainingAmountMl: parsed.data.remainingAmountMl ?? null,
    estimatedIntakeMl: calculateEstimatedIntakeMl(
      parsed.data.suppliedAmountMl,
      parsed.data.remainingAmountMl,
    ),
    hasSpill: parsed.data.hasSpill,
    wasWaterChanged: parsed.data.wasWaterChanged,
    subjectiveAmount: parsed.data.subjectiveAmount ?? null,
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/water-records`);
}

export async function updateWaterRecordAction(
  catId: string,
  id: string,
  _prevState: WaterRecordFormState,
  formData: FormData,
): Promise<WaterRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(waterRecords)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      measurementMethod: parsed.data.measurementMethod,
      suppliedAmountMl: parsed.data.suppliedAmountMl,
      remainingAmountMl: parsed.data.remainingAmountMl ?? null,
      estimatedIntakeMl: calculateEstimatedIntakeMl(
        parsed.data.suppliedAmountMl,
        parsed.data.remainingAmountMl,
      ),
      hasSpill: parsed.data.hasSpill,
      wasWaterChanged: parsed.data.wasWaterChanged,
      subjectiveAmount: parsed.data.subjectiveAmount ?? null,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(waterRecords.id, id), eq(waterRecords.catId, catId)))
    .returning({ id: waterRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/water-records`);
}

export async function deleteWaterRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(waterRecords)
    .where(and(eq(waterRecords.id, id), eq(waterRecords.catId, catId)));
  redirect(`/cats/${catId}/water-records`);
}
