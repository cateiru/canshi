"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cleaningRecords, cleaningTargets } from "@/db/schema";
import { combineDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
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
  // cleaningTargetId が catId に属し、かつ有効であることを確認してから登録する
  // （URL の cleaningTargetId が改ざんされ、他猫や無効化済みの掃除対象に記録が
  // 紐付いてしまうのを防ぐ。無効対象は編集・記録閲覧のみが仕様のため新規登録は拒否する）
  const [target] = await db
    .select({ id: cleaningTargets.id })
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
        eq(cleaningTargets.isActive, true),
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
  // 無効化済みの掃除対象は編集・記録閲覧のみが仕様のため新規登録は拒否する
  const [target] = await db
    .select({ id: cleaningTargets.id })
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
        eq(cleaningTargets.isActive, true),
      ),
    )
    .limit(1);

  if (target) {
    await db.insert(cleaningRecords).values({
      catId,
      cleaningTargetId,
      // 手入力（combineDateTimeUtc）と同じ「naive UTC」の時刻モデルに揃える。
      // サーバー側の new Date() は実際のUTCのため、そのまま保存すると
      // JSTの時計とずれた時刻で記録されてしまう
      performedAt: getNaiveUtcNow(),
    });
  }

  redirect(`/cats/${catId}/cleaning`);
}
