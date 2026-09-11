"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cleaningRecords, cleaningTargets } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  type CleaningRecordFormFieldErrors,
  cleaningRecordFormSchema,
} from "./recordSchema";

export type CleaningRecordFormState = {
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
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  // cleaningTargetId が catId に属することを確認してから登録する
  // （URL の cleaningTargetId が改ざんされ、他猫の掃除対象に記録が紐付いてしまうのを防ぐ）
  const [target] = await db
    .select({ id: cleaningTargets.id })
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
      ),
    )
    .limit(1);

  if (!target) {
    return { formError: "掃除対象が見つかりませんでした" };
  }

  await db.insert(cleaningRecords).values({
    catId,
    cleaningTargetId,
    performedAt: combineDateTimeUtc(
      parsed.data.performedDate,
      parsed.data.performedTime,
    ),
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`);
}

export async function updateCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  id: string,
  _prevState: CleaningRecordFormState,
  formData: FormData,
): Promise<CleaningRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(cleaningRecords)
    .set({
      performedAt: combineDateTimeUtc(
        parsed.data.performedDate,
        parsed.data.performedTime,
      ),
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cleaningRecords.id, id),
        eq(cleaningRecords.catId, catId),
        eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
      ),
    )
    .returning({ id: cleaningRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`);
}

export async function deleteCleaningRecordAction(
  catId: string,
  cleaningTargetId: string,
  id: string,
): Promise<void> {
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
  redirect(`/cats/${catId}/cleaning/targets/${cleaningTargetId}/records`);
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
  const db = getDb();
  const [target] = await db
    .select({ id: cleaningTargets.id })
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
      ),
    )
    .limit(1);

  if (target) {
    await db.insert(cleaningRecords).values({
      catId,
      cleaningTargetId,
      performedAt: new Date(),
    });
  }

  redirect(`/cats/${catId}/cleaning`);
}
