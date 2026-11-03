import { IconButtonLink } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { countUnreadNotifications } from "../infrastructure/queries";
import styles from "./NotificationBadge.module.css";

type NotificationBadgeProps = {
  /** ログイン中のユーザー。所属する家の猫の通知だけを数える */
  userId: string;
  className?: string;
};

/** ヘッダーの通知アイコン。未読の未対応通知があれば件数バッジを重ねる */
export async function NotificationBadge({
  userId,
  className,
}: NotificationBadgeProps) {
  const unreadCount = await countUnreadNotifications(new Date(), userId);

  const label = unreadCount > 0 ? `通知、未読 ${unreadCount} 件` : "通知";

  return (
    <IconButtonLink
      href="/notifications"
      icon={NotificationSettingsIcon}
      className={className}
      aria-label={label}
      title={label}
    >
      {unreadCount > 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </IconButtonLink>
  );
}
