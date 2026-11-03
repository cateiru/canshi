import type {
  CleaningTargetContent,
  CleaningTargetSchedule,
} from "./cleaningTarget";

/**
 * 掃除対象の保存先。どの操作も猫（`catId`）で絞り、別の猫の掃除対象には触れない。
 * 実装は `../infrastructure/cleaningTargetRepository.ts`
 */
export interface CleaningTargetRepository {
  /** 猫の掃除対象を読む。`activeOnly` なら有効な対象に限る。見つからなければ null */
  findScheduleForCat(
    catId: string,
    id: string,
    options: { activeOnly: boolean },
  ): Promise<CleaningTargetSchedule | null>;
  /** 掃除対象を一覧の末尾に追加する */
  add(catId: string, content: CleaningTargetContent): Promise<void>;
  /** 掃除対象を書き換える。見つからなければ false */
  update(
    catId: string,
    id: string,
    content: CleaningTargetContent,
  ): Promise<boolean>;
  /** 掃除対象を、実施記録・通知・通知設定ごと削除する */
  remove(catId: string, id: string): Promise<void>;
}
