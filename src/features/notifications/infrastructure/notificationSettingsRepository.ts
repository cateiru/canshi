import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notificationSettings } from "@/db/schema";
import {
  type CleaningTargetSetting,
  toCatNotificationKindSettings,
} from "../domain/notificationSettings";
import type { NotificationSettingsRepository } from "../domain/notificationSettingsRepository";
import type { CatNotificationSettingsFormInput } from "../domain/settingsSchema";

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
  const kindEntries = toCatNotificationKindSettings(data);

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

  // kindStatements は常に6件（固定の種類分）あるため、db.batch が要求する
  // 「1件以上」のタプル型を満たすことは実行時に保証されている
  return [...kindStatements, ...cleaningStatements] as [
    (typeof kindStatements)[number],
    ...(
      | (typeof kindStatements)[number]
      | (typeof cleaningStatements)[number]
    )[],
  ];
}

/** D1 に保存する `NotificationSettingsRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createNotificationSettingsRepository(
  d1?: D1Database,
): NotificationSettingsRepository {
  const db = getDb(d1);
  return {
    async saveForCat(catId, cleaningTargets, data) {
      // 複数項目の更新を1回の `db.batch` にまとめることで、途中失敗による一部項目だけの保存を防ぐ
      await db.batch(
        buildCatNotificationSettingsBatch(db, catId, cleaningTargets, data),
      );
    },
  };
}
