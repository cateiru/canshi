import type {
  FeedingNotificationKind,
  FeedingScheduleContent,
  FeedingScheduleNotifySettings,
} from "./feedingSchedule";

/**
 * ごはんの時間の保存先。書き込みは、ユーザーが家のメンバーであることを同じ文の中で確かめる。
 * 実装は `../infrastructure/feedingScheduleRepository.ts`
 */
export interface FeedingScheduleRepository {
  /** 家に同じ時刻のごはんの時間があるか */
  existsAtTime(householdId: string, time: string): Promise<boolean>;
  /**
   * ごはんの時間を追加する。ユーザーが家のメンバーでない、または同じ時刻が
   * 別のリクエストで追加されていれば追加せずに false
   */
  addForMember(
    householdId: string,
    userId: string,
    content: FeedingScheduleContent,
  ): Promise<boolean>;
  /**
   * 通知の設定を変える。`dismissKinds` の種類の未対応の通知は同じ batch で無視にする。
   * ユーザーが家のメンバーでない、または見つからなければ false
   */
  updateNotifyForMember(
    householdId: string,
    userId: string,
    id: string,
    settings: FeedingScheduleNotifySettings,
    dismissKinds: FeedingNotificationKind[],
  ): Promise<boolean>;
  /**
   * ごはんの時間を削除し、この時間の未対応の通知を同じ batch で無視にする。
   * 対応済みの通知は履歴として残す。ユーザーが家のメンバーでない、または見つからなければ false
   */
  removeForMember(
    householdId: string,
    userId: string,
    id: string,
  ): Promise<boolean>;
}
