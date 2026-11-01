"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { brushingRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { createBrushingRecord, updateBrushingRecord } from "./mutations";
import {
  type BrushingRecordFormFieldErrors,
  brushingRecordFormSchema,
} from "./schema";

export type BrushingRecordFormState = SubmitRedirect & {
  fieldErrors?: BrushingRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return brushingRecordFormSchema.safeParse({
    performedDate: formData.get("performedDate"),
    performedTime: formData.get("performedTime"),
    durationMinutes: formData.get("durationMinutes"),
    shedAmount: formData.get("shedAmount"),
    hasMats: formData.get("hasMats"),
    hasSkinIssue: formData.get("hasSkinIssue"),
    memo: formData.get("memo"),
  });
}

export async function createBrushingRecordAction(
  catId: string,
  _prevState: BrushingRecordFormState,
  formData: FormData,
): Promise<BrushingRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createBrushingRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/brushing-records` };
}

export async function updateBrushingRecordAction(
  catId: string,
  id: string,
  _prevState: BrushingRecordFormState,
  formData: FormData,
): Promise<BrushingRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateBrushingRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/brushing-records` };
}

export async function deleteBrushingRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  await db
    .delete(brushingRecords)
    .where(and(eq(brushingRecords.id, id), eq(brushingRecords.catId, catId)));
  redirect(`/cats/${catId}/brushing-records`, "replace");
}
