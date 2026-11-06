import type { RecordActor } from "@/db/schema";
import type { NotificationTarget } from "./notification";

/**
 * 通知の保存先。`userId` を受け取る操作は、ユーザーが参照できる通知（ユーザーの家の猫・
 * ユーザーの家・ユーザー本人宛ての通知）だけを対象にし、別の家の通知は存在しない通知と同じく扱う。
 * 実装は `../infrastructure/notificationRepository.ts`
 */
export interface NotificationRepository {
  /** ユーザーが参照できる通知を読む。見つからなければ null */
  findAccessible(
    userId: string,
    id: string,
  ): Promise<NotificationTarget | null>;
  /** ユーザーが参照できる通知の状態を変える。参照できない・存在しない通知では何もしない */
  setStatusIfAccessible(
    userId: string,
    id: string,
    status: "done" | "dismissed",
  ): Promise<void>;
  /**
   * 掃除の通知（`cleaning_due`）を完了にし、同時にその掃除対象へ `performedAt` の掃除記録を
   * 追加する。通知が完了済み・掃除対象が無効なら記録は追加しない（同時に完了したときの二重記録を防ぐ）
   */
  completeWithCleaningRecord(
    id: string,
    performedAt: Date,
    actor: RecordActor,
  ): Promise<void>;
  /** 症状の確認通知を完了にし、同時に症状の記録を「解消」にする */
  completeWithSymptomResolved(
    id: string,
    catId: string,
    symptomId: string,
    actor: RecordActor,
  ): Promise<void>;
  /** 症状について未対応のまま残っている確認通知（`symptom_ongoing`）を完了にする */
  completeOngoingSymptomNotifications(
    catId: string,
    symptomId: string,
  ): Promise<void>;
  /** 通知を延期し、再通知のため既読・Push の送信済みの記録を消す */
  snooze(id: string, snoozedUntil: Date): Promise<void>;
  /** 指定した通知のうち、ユーザーが参照できるものを既読にする */
  markReadIfAccessible(
    userId: string,
    ids: string[],
    readAt: Date,
  ): Promise<void>;
}
