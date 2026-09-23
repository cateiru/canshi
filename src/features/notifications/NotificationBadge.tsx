import { ButtonLink } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./NotificationBadge.module.css";
import { countUnreadNotifications } from "./queries";

type NotificationBadgeProps = {
  className?: string;
};

/** ヘッダーの通知アイコン。未読の未対応通知があれば件数バッジを重ねる */
export async function NotificationBadge({
  className,
}: NotificationBadgeProps = {}) {
  const unreadCount = await countUnreadNotifications(new Date());

  const label = unreadCount > 0 ? `通知、未読 ${unreadCount} 件` : "通知";

  return (
    <ButtonLink
      href="/notifications"
      variant="secondary"
      className={className}
      aria-label={label}
      title={label}
    >
      <NotificationSettingsIcon aria-hidden="true" size={20} />
      {unreadCount > 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </ButtonLink>
  );
}
