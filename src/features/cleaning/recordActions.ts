"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cleaningRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createCleaningRecord,
  createCleaningRecordNow,
  updateCleaningRecord,
} from "./recordMutations";
import {
  type CleaningRecordFormFieldErrors,
  cleaningRecordFormSchema,
} from "./recordSchema";

export type CleaningRecordFormState = SubmitRedirect & {
  fieldErrors?: CleaningRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return cleaningRecordFormSchema.safeParse({
    performedDate: formData.get("performedDate"),
    performedTime: formData.get("performedTime"),
    memo: formData.get("memo"),
  });
}

export async function createCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  _prevState: CleaningRecordFormState,
  formData: FormData,
): Promise<CleaningRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await createCleaningRecord(catId, cleaningTargetId, parsed.data))) {
    return { formError: "掃除対象が見つかりませんでした" };
  }

  return {
    redirectTo: `/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`,
  };
}

export async function updateCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  id: string,
  _prevState: CleaningRecordFormState,
  formData: FormData,
): Promise<CleaningRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateCleaningRecord(catId, cleaningTargetId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  return {
    redirectTo: `/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`,
  };
}

export async function deleteCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  await db
    .delete(cleaningRecords)
    .where(
      and(
        eq(cleaningRecords.id, id),
        eq(cleaningRecords.catId, catId),
        eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
      ),
    );
  redirect(
    `/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`,
    "replace",
  );
}

/**
 * 掃除対象の一覧から「今すぐ掃除した」をワンタップで記録する。
 * JS 無効環境でも動くよう、フォームの action にそのまま渡せる形にする
 */
export async function quickCreateCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  _formData: FormData,
): Promise<void> {
  await requireCatAccess(catId);
  // 無効化済みの掃除対象は編集・記録閲覧のみが仕様のため、記録せずに一覧へ戻す
  await createCleaningRecordNow(catId, cleaningTargetId);

  redirect(`/cats/${catId}/cleaning`, "replace");
}
