import Link from "next/link";
import { TbBell } from "react-icons/tb";
import styles from "./NotificationBadge.module.css";
import { countUnreadNotifications } from "./queries";

/** ヘッダーの通知アイコン。未読の未対応通知があれば件数バッジを重ねる */
export async function NotificationBadge() {
  const unreadCount = await countUnreadNotifications(new Date());

  const label = unreadCount > 0 ? `通知、未読 ${unreadCount} 件` : "通知";

  return (
    <Link href="/notifications" className={styles.link} aria-label={label}>
      <TbBell className={styles.icon} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
