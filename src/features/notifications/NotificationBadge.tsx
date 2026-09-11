import Link from "next/link";
import { TbBell } from "react-icons/tb";
import styles from "./NotificationBadge.module.css";
import { countUnreadNotifications } from "./queries";

/** ヘッダーの通知アイコン。未読の未対応通知があれば件数バッジを重ねる */
export async function NotificationBadge() {
  const unreadCount = await countUnreadNotifications(new Date());

  return (
    <Link href="/notifications" className={styles.link} aria-label="通知">
      <TbBell className={styles.icon} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className={styles.badge}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
