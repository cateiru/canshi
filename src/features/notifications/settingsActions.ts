"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  type CatNotificationSettingsFormFieldErrors,
  catNotificationSettingsFormSchema,
} from "./settingsSchema";
import { buildCatNotificationSettingsBatch } from "./settingsUpsert";

export type CatNotificationSettingsFormState = {
  fieldErrors?: CatNotificationSettingsFormFieldErrors;
  formError?: string;
};

/**
 * 猫ごとの通知設定を保存する。
 *
 * `notification_settings` の UNIQUE インデックスは `reference_id` が NULL の行と
 * NULL でない行とで分かれている（`src/db/schema/notification-settings.ts` 参照）ため、
 * それぞれを対象にした `onConflictDoUpdate` で保存できる（`buildCatNotificationSettingsBatch`
 * 参照）。読んでから更新／挿入を選ぶ方式と違い、同時保存でも重複行や更新の取りこぼしが
 * 起きない。複数項目の更新を1回の `db.batch` にまとめることで、途中失敗による
 * 一部項目だけの保存も防ぐ
 */
export async function updateCatNotificationSettingsAction(
  catId: string,
  cleaningTargetIds: string[],
  _prevState: CatNotificationSettingsFormState,
  formData: FormData,
): Promise<CatNotificationSettingsFormState> {
  const parsed = catNotificationSettingsFormSchema.safeParse({
    birthdayYearlyEnabled: formData.get("birthdayYearlyEnabled"),
    birthdayHalfYearEnabled: formData.get("birthdayHalfYearEnabled"),
    daysMilestoneEnabled: formData.get("daysMilestoneEnabled"),
    shampooElapsedEnabled: formData.get("shampooElapsedEnabled"),
    shampooElapsedMonths: formData.get("shampooElapsedMonths"),
    weightMeasurementEnabled: formData.get("weightMeasurementEnabled"),
    weightMeasurementDays: formData.get("weightMeasurementDays"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const cleaningTargets = cleaningTargetIds.map((targetId) => ({
    id: targetId,
    isEnabled: formData.get(`cleaningEnabled_${targetId}`) === "on",
  }));

  await db.batch(
    buildCatNotificationSettingsBatch(db, catId, cleaningTargets, parsed.data),
  );

  revalidatePath(`/cats/${catId}/notification-settings`);
  redirect(`/cats/${catId}/notification-settings`);
}
