import type { Notification } from "@/db/schema";

/**
 * 通知（エンティティ）。猫・家・ユーザーのいずれかに属する。
 * 状態の判定（未対応か）は `./status.ts` を参照
 */
export type { Notification };

/** 通知センターの操作で、通知の種類と参照先を確かめるために読む項目 */
export type NotificationTarget = Pick<
  Notification,
  "id" | "catId" | "kind" | "referenceId" | "status"
>;
