"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { notificationPreferences } from "@/db/schema";
import {
  type CatNotificationSettingsFormFieldErrors,
  catNotificationSettingsFormSchema,
  type NotificationPreferencesFormFieldErrors,
  notificationPreferencesFormSchema,
} from "./settingsSchema";
import { buildCatNotificationSettingsBatch } from "./settingsUpsert";

export type NotificationPreferencesFormState = {
  fieldErrors?: NotificationPreferencesFormFieldErrors;
  formError?: string;
};

/** 通知時刻・タイムゾーンの全体設定を保存する。`id` が固定値なので単純に upsert できる */
export async function updateNotificationPreferencesAction(
  _prevState: NotificationPreferencesFormState,
  formData: FormData,
): Promise<NotificationPreferencesFormState> {
  const parsed = notificationPreferencesFormSchema.safeParse({
    notifyTime: formData.get("notifyTime"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db
    .insert(notificationPreferences)
    .values({
      id: "default",
      notifyTime: parsed.data.notifyTime,
      timezone: parsed.data.timezone,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.id,
      set: {
        notifyTime: parsed.data.notifyTime,
        timezone: parsed.data.timezone,
        updatedAt: new Date(),
      },
    });

  // `redirect()` で戻る先が同じパスのため、クライアントの Router Cache に残っている
  // 保存前のデータが再利用されないよう明示的に無効化する
  revalidatePath("/settings/notifications");
  redirect("/settings/notifications");
}

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
