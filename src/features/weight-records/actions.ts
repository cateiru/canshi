"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { weightRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { createWeightRecord, updateWeightRecord } from "./mutations";
import {
  type WeightRecordFormFieldErrors,
  weightRecordFormSchema,
} from "./schema";

export type WeightRecordFormState = SubmitRedirect & {
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
    bcs: formData.get("bcs"),
  });
}

export async function createWeightRecordAction(
  catId: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createWeightRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/weight-records` };
}

export async function updateWeightRecordAction(
  catId: string,
  id: string,
  _prevState: WeightRecordFormState,
  formData: FormData,
): Promise<WeightRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateWeightRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/weight-records` };
}

export async function deleteWeightRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  await db
    .delete(weightRecords)
    .where(and(eq(weightRecords.id, id), eq(weightRecords.catId, catId)));
  redirect(`/cats/${catId}/weight-records`, "replace");
}
