import type { CleaningTargetSetting } from "./notificationSettings";
import type { CatNotificationSettingsFormInput } from "./settingsSchema";

/**
 * 猫ごとの通知設定の保存先。実装は `../infrastructure/notificationSettingsRepository.ts`
 */
export interface NotificationSettingsRepository {
  /** 猫の通知設定を、掃除対象ごとの設定とあわせてまとめて保存する */
  saveForCat(
    catId: string,
    cleaningTargets: CleaningTargetSetting[],
    data: CatNotificationSettingsFormInput,
  ): Promise<void>;
}
