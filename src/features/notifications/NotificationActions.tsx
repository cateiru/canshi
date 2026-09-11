"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addToast, Button } from "@/components/ui";
import {
  dismissNotificationAction,
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
};

/**
 * 通知センター（`src/app/notifications/`）の各通知に対する、完了・延期・無視の操作。
 * Server Action の実行後、`router.refresh()` でサーバー側の一覧を取り直す
 */
export function NotificationActions({
  notificationId,
}: NotificationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<NotificationActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        addToast({ title: result.error, color: "error" });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={styles.actions}>
      <Button
        variant="primary"
        isDisabled={isPending}
        onPress={() => run(() => markNotificationDoneAction(notificationId))}
      >
        完了にする
      </Button>
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
