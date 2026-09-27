"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addToast, Button } from "@/components/ui";
import type { NotificationKind } from "@/db/schema";
import {
  dismissNotificationAction,
  markCleaningNotificationDoneAction,
  markNotificationDoneAction,
  type NotificationActionResult,
  snoozeNotificationAction,
} from "./actions";
import styles from "./NotificationActions.module.css";

const SNOOZE_OPTIONS = [
  { label: "1日延期", days: 1 },
  { label: "3日延期", days: 3 },
  { label: "1週間延期", days: 7 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

type NotificationActionsProps = {
  notificationId: string;
  kind: NotificationKind;
};

/**
 * 通知センター（`src/app/notifications/`）の各通知に対する、完了・延期・無視の操作。
 * Server Action の実行後、`router.refresh()` でサーバー側の一覧を取り直す。
 * 掃除の通知は「完了にする」の代わりに「掃除して完了にする」を表示し、
 * 完了と同時に掃除記録を追加する
 */
export function NotificationActions({
  notificationId,
  kind,
}: NotificationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(
    action: () => Promise<NotificationActionResult>,
    successMessage?: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        addToast({ title: result.error, color: "error" });
        return;
      }
      if (successMessage) {
        addToast({ title: successMessage, color: "success" });
      }
      router.refresh();
    });
  }

  return (
    <div className={styles.actions}>
      {kind === "cleaning_due" ? (
        <Button
          variant="primary"
          isDisabled={isPending}
          onPress={() =>
            run(
              () => markCleaningNotificationDoneAction(notificationId),
              "掃除記録を追加しました",
            )
          }
        >
          掃除して完了にする
        </Button>
      ) : (
        <Button
          variant="primary"
          isDisabled={isPending}
          onPress={() => run(() => markNotificationDoneAction(notificationId))}
        >
          完了にする
        </Button>
      )}
      {SNOOZE_OPTIONS.map((option) => (
        <Button
          key={option.days}
          variant="secondary"
          isDisabled={isPending}
          onPress={() =>
            run(() =>
              snoozeNotificationAction(
                notificationId,
                new Date(Date.now() + option.days * DAY_MS),
              ),
            )
          }
        >
          {option.label}
        </Button>
      ))}
      <Button
        variant="secondary"
        isDisabled={isPending}
        onPress={() => run(() => dismissNotificationAction(notificationId))}
      >
        無視する
      </Button>
    </div>
  );
}
