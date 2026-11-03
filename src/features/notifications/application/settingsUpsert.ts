import type { CleaningTargetSetting } from "../domain/notificationSettings";
import type { CatNotificationSettingsFormInput } from "../domain/settingsSchema";
import { createNotificationSettingsRepository } from "../infrastructure/notificationSettingsRepository";

export type { CleaningTargetSetting } from "../domain/notificationSettings";

/**
 * 猫ごとの通知設定を保存する（ユースケース）。すべての項目をまとめて保存し、一部項目だけの保存を防ぐ
 * （同時保存の扱いは `buildCatNotificationSettingsBatch` 参照）。
 * 猫を参照できるかは呼び出し側で確かめる
 */
export async function saveCatNotificationSettings(
  catId: string,
  cleaningTargets: CleaningTargetSetting[],
  data: CatNotificationSettingsFormInput,
  d1?: D1Database,
): Promise<void> {
  await createNotificationSettingsRepository(d1).saveForCat(
    catId,
    cleaningTargets,
    data,
  );
}
