import type { NotificationMessage } from "./messages";
import type {
  FeedingScheduleForRule,
  HouseholdNotificationCandidate,
  NotificationCandidate,
  OpenSymptom,
  SymptomOngoingCandidate,
} from "./rules";

/** 猫についての通知のうち、症状の確認通知以外の候補 */
export type CatNotificationCandidate = Exclude<
  NotificationCandidate,
  SymptomOngoingCandidate
>;

/**
 * 通知の生成（`generateNotifications`）が判定に使う記録を読み、まだ生成していない通知を
 * 書く先。書き込みはどれも `dedupe_key` が登録済みなら何もしないため、同じ候補を何度書いても
 * 重複しない。実装は `../infrastructure/notificationGenerationRepository.ts`
 */
export interface NotificationGenerationRepository {
  /** 全猫の未解消の症状を、確認通知の対応状況とあわせて猫 id ごとに読む */
  listOpenSymptomsByCat(): Promise<Map<string, OpenSymptom[]>>;
  /** 猫の最後のシャンプーの日時。記録がなければ null */
  findLatestShampooAt(catId: string): Promise<Date | null>;
  /** 猫の最後の体重測定の日時。記録がなければ null */
  findLatestWeightAt(catId: string): Promise<Date | null>;
  /** 家 id ごとの、ごはんの時間 */
  listFeedingSchedulesByHousehold(): Promise<
    Map<string, FeedingScheduleForRule[]>
  >;
  /** 猫 id ごとの、直近のごはん記録の発生日時（naive UTC） */
  listRecentFeedingAtsByCat(now: Date): Promise<Map<string, Date[]>>;
  /** 猫についての通知を書く */
  insertCatNotification(
    candidate: CatNotificationCandidate,
    message: NotificationMessage,
  ): Promise<void>;
  /** 症状の確認通知を、対象の症状がまだ存在し未解消である場合に限って書く */
  insertSymptomOngoingNotification(
    candidate: SymptomOngoingCandidate,
    message: NotificationMessage,
  ): Promise<void>;
  /**
   * 家についての通知（ごはんの時間）を、ごはんの時間がまだ有効で、家に猫がいて、
   * 範囲内に家の猫のごはん記録がない場合に限って書く
   */
  insertHouseholdNotification(
    candidate: HouseholdNotificationCandidate,
    message: NotificationMessage,
  ): Promise<void>;
}
