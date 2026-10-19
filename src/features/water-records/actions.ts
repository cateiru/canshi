"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { waterRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { createWaterRecord, updateWaterRecord } from "./mutations";
import {
  type WaterRecordFormFieldErrors,
  waterRecordFormSchema,
} from "./schema";

export type WaterRecordFormState = SubmitRedirect & {
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
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createWaterRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/water-records` };
}

export async function updateWaterRecordAction(
  catId: string,
  id: string,
  _prevState: WaterRecordFormState,
  formData: FormData,
): Promise<WaterRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateWaterRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/water-records` };
}

export async function deleteWaterRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  await db
    .delete(waterRecords)
    .where(and(eq(waterRecords.id, id), eq(waterRecords.catId, catId)));
  redirect(`/cats/${catId}/water-records`, "replace");
}
