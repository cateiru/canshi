import { sql } from "drizzle-orm";
import type { getDb } from "@/db/client";
import type { NotificationKind } from "@/db/schema";
import { notificationSettings } from "@/db/schema";
import type { CatNotificationSettingsFormInput } from "./settingsSchema";

type KindSettingEntry = {
  kind: Exclude<NotificationKind, "cleaning_due">;
  isEnabled: boolean;
  params: { months?: number; days?: number } | null;
};

type CleaningTargetSetting = {
  id: string;
  isEnabled: boolean;
};

/**
 * 猫ごとの通知設定を保存する insert/update 文を組み立てる。
 *
 * `notification_settings` の UNIQUE インデックスは、`reference_id` が NULL の行用
 * （`(cat_id, kind)` WHERE `reference_id IS NULL`）と NULL でない行用
 * （`(cat_id, kind, reference_id)` WHERE `reference_id IS NOT NULL`）に分かれている
 * （`src/db/schema/notification-settings.ts` 参照）。それぞれを対象にした
 * `onConflictDoUpdate` を使うことで、読んでから insert/update を選ぶ方式と違い、
 * 同時保存でも重複行や更新の取りこぼしが起きない
 */
export function buildCatNotificationSettingsBatch(
  db: ReturnType<typeof getDb>,
  catId: string,
  cleaningTargets: CleaningTargetSetting[],
  data: CatNotificationSettingsFormInput,
) {
  const kindEntries: KindSettingEntry[] = [
    {
      kind: "birthday_yearly",
      isEnabled: data.birthdayYearlyEnabled,
      params: null,
    },
    {
      kind: "birthday_half_year",
      isEnabled: data.birthdayHalfYearEnabled,
      params: null,
    },
    {
      kind: "days_milestone",
      isEnabled: data.daysMilestoneEnabled,
      params: null,
    },
    {
      kind: "shampoo_elapsed",
      isEnabled: data.shampooElapsedEnabled,
      params: { months: data.shampooElapsedMonths },
    },
    {
      kind: "weight_measurement",
      isEnabled: data.weightMeasurementEnabled,
      params: { days: data.weightMeasurementDays },
    },
  ];

  const kindStatements = kindEntries.map((entry) =>
    db
      .insert(notificationSettings)
      .values({
        catId,
        kind: entry.kind,
        isEnabled: entry.isEnabled,
        params: entry.params,
      })
      .onConflictDoUpdate({
        target: [notificationSettings.catId, notificationSettings.kind],
        targetWhere: sql`${notificationSettings.referenceId} IS NULL`,
        set: {
          isEnabled: entry.isEnabled,
          params: entry.params,
          updatedAt: new Date(),
        },
      }),
  );

  const cleaningStatements = cleaningTargets.map(({ id, isEnabled }) =>
    db
      .insert(notificationSettings)
      .values({
        catId,
        kind: "cleaning_due",
        referenceId: id,
        isEnabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationSettings.catId,
          notificationSettings.kind,
          notificationSettings.referenceId,
        ],
        targetWhere: sql`${notificationSettings.referenceId} IS NOT NULL`,
        set: { isEnabled, updatedAt: new Date() },
      }),
  );

  // kindStatements は常に5件（固定の種類分）あるため、db.batch が要求する
  // 「1件以上」のタプル型を満たすことは実行時に保証されている
  return [...kindStatements, ...cleaningStatements] as [
    (typeof kindStatements)[number],
    ...(
      | (typeof kindStatements)[number]
      | (typeof cleaningStatements)[number]
    )[],
  ];
}
