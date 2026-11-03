import type { CleaningTarget } from "@/db/schema";

/** 掃除対象（エンティティ）。猫（`catId`）に属し、実施記録（`CleaningRecord`）を持つ */
export type { CleaningTarget };

/** 掃除対象の中身。ID・猫・並び順・作成日時を除いたもの */
export type CleaningTargetContent = Pick<
  CleaningTarget,
  "name" | "frequencyValue" | "frequencyUnit" | "isActive" | "notifyTime"
>;

/** 記録の保存で、次回予定日を計算するために読む項目 */
export type CleaningTargetSchedule = Pick<
  CleaningTarget,
  "id" | "frequencyValue" | "frequencyUnit" | "notifyTime"
>;

/** 掃除対象と、最後に掃除した日時から求めた次回予定日・期限切れか */
export type CleaningTargetWithStatus = {
  target: CleaningTarget;
  lastPerformedAt: Date | null;
  nextDueAt: Date | null;
  isOverdue: boolean;
};
