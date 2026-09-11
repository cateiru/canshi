"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import type { NotificationKind } from "@/db/schema";
import { notificationPreferences, notificationSettings } from "@/db/schema";
import {
  type CatNotificationSettingsFormFieldErrors,
  catNotificationSettingsFormSchema,
  type NotificationPreferencesFormFieldErrors,
  notificationPreferencesFormSchema,
} from "./settingsSchema";

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

type KindSettingEntry = {
  kind: Exclude<NotificationKind, "cleaning_due">;
  isEnabled: boolean;
  params: { months?: number; days?: number } | null;
};

/**
 * 猫ごとの通知設定を保存する。
 *
 * `notification_settings` の `(cat_id, kind, reference_id)` UNIQUE 制約は、SQLite が
 * NULL 同士を等しいとみなさないため `reference_id` が NULL の行（掃除以外の種類）どうしの
 * 重複を防げない。そのため `onConflictDoUpdate` は使わず、既存行を読んでから
 * 更新／挿入のどちらかを行う（`src/db/schema/notification-settings.test.ts` 参照）
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
  const existingRows = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.catId, catId));

  const existingByKind = new Map<string, (typeof existingRows)[number]>();
  const existingByTarget = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows) {
    if (row.kind === "cleaning_due" && row.referenceId) {
      existingByTarget.set(row.referenceId, row);
    } else {
      existingByKind.set(row.kind, row);
    }
  }

  const kindEntries: KindSettingEntry[] = [
    {
      kind: "birthday_yearly",
      isEnabled: parsed.data.birthdayYearlyEnabled,
      params: null,
    },
    {
      kind: "birthday_half_year",
      isEnabled: parsed.data.birthdayHalfYearEnabled,
      params: null,
    },
    {
      kind: "days_milestone",
      isEnabled: parsed.data.daysMilestoneEnabled,
      params: null,
    },
    {
      kind: "shampoo_elapsed",
      isEnabled: parsed.data.shampooElapsedEnabled,
      params: { months: parsed.data.shampooElapsedMonths },
    },
    {
      kind: "weight_measurement",
      isEnabled: parsed.data.weightMeasurementEnabled,
      params: { days: parsed.data.weightMeasurementDays },
    },
  ];

  for (const entry of kindEntries) {
    const existing = existingByKind.get(entry.kind);
    if (existing) {
      await db
        .update(notificationSettings)
        .set({
          isEnabled: entry.isEnabled,
          params: entry.params,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.id, existing.id));
    } else {
      await db.insert(notificationSettings).values({
        catId,
        kind: entry.kind,
        isEnabled: entry.isEnabled,
        params: entry.params,
      });
    }
  }

  for (const targetId of cleaningTargetIds) {
    const isEnabled = formData.get(`cleaningEnabled_${targetId}`) === "on";
    const existing = existingByTarget.get(targetId);
    if (existing) {
      await db
        .update(notificationSettings)
        .set({ isEnabled, updatedAt: new Date() })
        .where(eq(notificationSettings.id, existing.id));
    } else {
      await db.insert(notificationSettings).values({
        catId,
        kind: "cleaning_due",
        referenceId: targetId,
        isEnabled,
      });
    }
  }

  revalidatePath(`/cats/${catId}/notification-settings`);
  redirect(`/cats/${catId}/notification-settings`);
}
