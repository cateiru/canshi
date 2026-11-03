import type { CleaningTarget } from "@/db/schema";
import { cleaningFrequency } from "./cleaningFrequency";

/** 掃除対象（エンティティ）。猫（`catId`）に属し、実施記録（`CleaningRecord`）を持つ */
export type { CleaningTarget };

/** 掃除対象の中身。ID・猫・並び順・作成日時を除いたもの */
export type CleaningTargetContent = Pick<
  CleaningTarget,
  "name" | "frequencyValue" | "frequencyUnit" | "isActive" | "notifyTime"
>;

/**
 * 掃除対象の中身を作る。頻度は値オブジェクト（`CleaningFrequency`）で確かめてから列に戻す。
 * 通知時刻を指定しなければ通知時刻なし
 */
export function toCleaningTargetContent(data: {
  name: string;
  frequencyValue: number;
  frequencyUnit: CleaningTarget["frequencyUnit"];
  isActive: boolean;
  notifyTime?: string | null;
}): CleaningTargetContent {
  const frequency = cleaningFrequency(data.frequencyValue, data.frequencyUnit);
  return {
    name: data.name,
    frequencyValue: frequency.value,
    frequencyUnit: frequency.unit,
    isActive: data.isActive,
    notifyTime: data.notifyTime ?? null,
  };
}

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
