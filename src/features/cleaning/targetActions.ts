"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  type CleaningTarget,
  cleaningRecords,
  cleaningTargets,
  notificationSettings,
  notifications,
} from "@/db/schema";
import {
  type CleaningTargetFormFieldErrors,
  cleaningTargetFormSchema,
} from "./targetSchema";

export type CleaningTargetFormState = {
  fieldErrors?: CleaningTargetFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return cleaningTargetFormSchema.safeParse({
    name: formData.get("name"),
    frequencyValue: formData.get("frequencyValue"),
    frequencyUnit: formData.get("frequencyUnit"),
    isActive: formData.get("isActive"),
  });
}

async function nextSortOrder(catId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      maxSortOrder: sql<number | null>`max(${cleaningTargets.sortOrder})`,
    })
    .from(cleaningTargets)
    .where(eq(cleaningTargets.catId, catId));
  return row?.maxSortOrder == null ? 0 : Number(row.maxSortOrder) + 1;
}

export async function createCleaningTargetAction(
  catId: string,
  _prevState: CleaningTargetFormState,
  formData: FormData,
): Promise<CleaningTargetFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(cleaningTargets).values({
    catId,
    name: parsed.data.name,
    frequencyValue: parsed.data.frequencyValue,
    frequencyUnit: parsed.data.frequencyUnit,
    isActive: parsed.data.isActive,
    sortOrder: await nextSortOrder(catId),
  });

  redirect(`/cats/${catId}/cleaning`);
}

/**
 * 初回利用時のプリセット（猫砂・おしっこシート）をワンタップで追加する
 */
export async function createCleaningTargetFromPresetAction(
  catId: string,
  name: string,
  frequencyValue: number,
  frequencyUnit: CleaningTarget["frequencyUnit"],
  _formData: FormData,
): Promise<void> {
  const db = getDb();
  await db.insert(cleaningTargets).values({
    catId,
    name,
    frequencyValue,
    frequencyUnit,
    isActive: true,
    sortOrder: await nextSortOrder(catId),
  });

  redirect(`/cats/${catId}/cleaning`);
}

export async function updateCleaningTargetAction(
  catId: string,
  id: string,
  _prevState: CleaningTargetFormState,
  formData: FormData,
): Promise<CleaningTargetFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(cleaningTargets)
    .set({
      name: parsed.data.name,
      frequencyValue: parsed.data.frequencyValue,
      frequencyUnit: parsed.data.frequencyUnit,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(cleaningTargets.id, id), eq(cleaningTargets.catId, catId)))
    .returning({ id: cleaningTargets.id });

  if (result.length === 0) {
    return { formError: "掃除対象が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/cleaning`);
}

export async function deleteCleaningTargetAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // cleaning_records から cleaning_targets への外部キー制約があるため実施記録も同時に削除する。
  // notifications・notification_settings の reference_id もこの対象を指しうるため
  // （`28`）、同じ batch でまとめて削除する。3つの delete の間に別リクエストが
  // 割り込まないよう、D1 の batch で原子的に実行する
  await db.batch([
    db
      .delete(cleaningRecords)
      .where(
        and(
          eq(cleaningRecords.cleaningTargetId, id),
          eq(cleaningRecords.catId, catId),
        ),
      ),
    db
      .delete(notifications)
      .where(
        and(
          eq(notifications.kind, "cleaning_due"),
          eq(notifications.referenceId, id),
        ),
      ),
    db
      .delete(notificationSettings)
      .where(
        and(
          eq(notificationSettings.kind, "cleaning_due"),
          eq(notificationSettings.referenceId, id),
        ),
      ),
    db
      .delete(cleaningTargets)
      .where(and(eq(cleaningTargets.id, id), eq(cleaningTargets.catId, catId))),
  ]);
  redirect(`/cats/${catId}/cleaning`);
}
