import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { Notification } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { NotificationActions } from "./NotificationActions";
import styles from "./NotificationList.module.css";

const RESOLVED_STATUS_LABEL: Record<string, string> = {
  done: "完了",
  dismissed: "無視",
};

type NotificationListProps = {
  notifications: Notification[];
  /** `pending` は完了・延期・無視の操作を表示する。`resolved` は状態バッジのみ表示する */
  mode: "pending" | "resolved";
  emptyMessage: string;
};

export function NotificationList({
  notifications,
  mode,
  emptyMessage,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <Card>
        <p>{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <Card>
            <div className={styles.header}>
              <Link href={notification.url} className={styles.title}>
                {notification.title}
              </Link>
              {mode === "resolved" ? (
                <Badge>{RESOLVED_STATUS_LABEL[notification.status]}</Badge>
              ) : null}
            </div>
            <p className={styles.body}>{notification.body}</p>
            <p className={styles.dueAt}>
              {splitDateTimeUtc(notification.dueAt).date}
            </p>
            {mode === "pending" ? (
              <NotificationActions notificationId={notification.id} />
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
