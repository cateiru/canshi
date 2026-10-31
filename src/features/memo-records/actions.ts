"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { memoRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { createMemoRecord, updateMemoRecord } from "./mutations";
import { type MemoRecordFormFieldErrors, memoRecordFormSchema } from "./schema";

export type MemoRecordFormState = SubmitRedirect & {
  fieldErrors?: MemoRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return memoRecordFormSchema.safeParse({
    hasDate: formData.get("hasDate"),
    recordedDate: formData.get("recordedDate"),
    recordedTime: formData.get("recordedTime"),
    content: formData.get("content"),
  });
}

export async function createMemoRecordAction(
  catId: string,
  _prevState: MemoRecordFormState,
  formData: FormData,
): Promise<MemoRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await createMemoRecord(catId, parsed.data);

  return { redirectTo: `/cats/${catId}/memo-records` };
}

export async function updateMemoRecordAction(
  catId: string,
  id: string,
  _prevState: MemoRecordFormState,
  formData: FormData,
): Promise<MemoRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateMemoRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return { redirectTo: `/cats/${catId}/memo-records` };
}

export async function deleteMemoRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  await db
    .delete(memoRecords)
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)));
  redirect(`/cats/${catId}/memo-records`, "replace");
}
