import Link from "next/link";
import { TbBellOff } from "react-icons/tb";
import { Badge, type BadgeColor } from "@/components/ui";
import type { Notification } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { NotificationActions } from "./NotificationActions";
import styles from "./NotificationList.module.css";

const RESOLVED_STATUS_LABEL: Record<string, string> = {
  done: "完了",
  dismissed: "無視",
};

const RESOLVED_STATUS_COLOR: Record<string, BadgeColor> = {
  done: "success",
  dismissed: "info",
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
      <div className={styles.emptyState}>
        <TbBellOff aria-hidden="true" size={32} />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <article className={styles.record}>
            <div className={styles.header}>
              <Link href={notification.url} className={styles.title}>
                {notification.title}
              </Link>
              {mode === "resolved" ? (
                <Badge color={RESOLVED_STATUS_COLOR[notification.status]}>
                  {RESOLVED_STATUS_LABEL[notification.status]}
                </Badge>
              ) : null}
            </div>
            <p className={styles.body}>{notification.body}</p>
            <p className={styles.dueAt}>
              <time dateTime={notification.dueAt.toISOString()}>
                {splitDateTimeUtc(notification.dueAt).date}
              </time>
            </p>
            {mode === "pending" ? (
              <NotificationActions notificationId={notification.id} />
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
