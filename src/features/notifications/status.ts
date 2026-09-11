import type { NotificationStatus } from "@/db/schema";

/**
 * 通知が「未対応」として扱われるかどうかを判定する。`pending` はそのまま未対応。
 * `snoozed` は `snoozedUntil` の到来後に未対応として扱う（行の `status` 自体は
 * `snoozed` のまま書き換えない。完了・無視の操作をしたときにだけ状態を書き換える）
 */
export function isNotificationPending(
  notification: { status: NotificationStatus; snoozedUntil: Date | null },
  now: Date,
): boolean {
  if (notification.status === "pending") {
    return true;
  }
  if (notification.status === "snoozed") {
    return (
      notification.snoozedUntil != null &&
      notification.snoozedUntil.getTime() <= now.getTime()
    );
  }
  return false;
}
