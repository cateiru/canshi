import type { CleaningRecordContent } from "./cleaningRecord";

/**
 * 掃除の実施記録の保存先。どの操作も猫（`catId`）と掃除対象（`cleaningTargetId`）で絞る。
 * 実装は `../infrastructure/cleaningRecordRepository.ts`
 */
export interface CleaningRecordRepository {
  /** 実施記録の実施日時を読む。見つからなければ null */
  findPerformedAt(
    catId: string,
    cleaningTargetId: string,
    id: string,
  ): Promise<Date | null>;
  /**
   * 実施記録を追加し、その ID を返す。`completeNotificationsDueBefore` を渡すと、
   * その日時より前の予定日の掃除の通知を同じ batch で完了にする
   */
  add(
    catId: string,
    cleaningTargetId: string,
    content: CleaningRecordContent,
    completeNotificationsDueBefore: Date | null,
  ): Promise<string>;
  /** 実施記録を書き換える。見つからなければ false。通知の扱いは `add` と同じ */
  update(
    catId: string,
    cleaningTargetId: string,
    id: string,
    content: CleaningRecordContent,
    completeNotificationsDueBefore: Date | null,
  ): Promise<boolean>;
  /** 実施記録を削除する。見つからなければ false */
  remove(catId: string, cleaningTargetId: string, id: string): Promise<boolean>;
}
