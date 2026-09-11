import Link from "next/link";
import { Breadcrumb, Tabs } from "@/components/ui";
import { listCats } from "@/features/cats/queries";
import { generateNotifications } from "@/features/notifications/generate";
import { MarkNotificationsRead } from "@/features/notifications/MarkNotificationsRead";
import { NotificationList } from "@/features/notifications/NotificationList";
import {
  listPendingNotifications,
  listResolvedNotifications,
} from "@/features/notifications/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<{ catId?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const { catId } = await searchParams;
  const now = new Date();

  // スケジュール実行（`29`）を待たず、通知センターを開いた時点で最新の通知を反映する
  await generateNotifications(now);

  const [pending, resolved, cats] = await Promise.all([
    listPendingNotifications(now, catId),
    listResolvedNotifications(catId),
    listCats(),
  ]);

  // 表示する未対応通知のうち、未読のものは画面表示後（マウント後）にまとめて既読にする
  // （`MarkNotificationsRead` 参照。ここではまだ既読化しない）
  const unreadIds = pending
    .filter((notification) => notification.readAt == null)
    .map((notification) => notification.id);

  return (
    <main className={styles.main}>
      <MarkNotificationsRead ids={unreadIds} />
      <Breadcrumb
        items={[{ label: "トップ", href: "/" }, { label: "通知センター" }]}
      />

      <h1>通知センター</h1>

      <nav className={styles.catFilter} aria-label="猫で絞り込む">
        <Link
          href="/notifications"
          className={catId ? styles.filterLink : styles.filterLinkActive}
        >
          すべて
        </Link>
        {cats.map((cat) => (
          <Link
            key={cat.id}
            href={`/notifications?catId=${cat.id}`}
            className={
              catId === cat.id ? styles.filterLinkActive : styles.filterLink
            }
          >
            {cat.name}
          </Link>
        ))}
      </nav>

      <Tabs
        items={[
          {
            id: "pending",
            label: `未対応（${pending.length}）`,
            content: (
              <NotificationList
                notifications={pending}
                mode="pending"
                emptyMessage="未対応の通知はありません。"
              />
            ),
          },
          {
            id: "resolved",
            label: "対応済み",
            content: (
              <NotificationList
                notifications={resolved}
                mode="resolved"
                emptyMessage="対応済みの通知はありません。"
              />
            ),
          },
        ]}
      />
    </main>
  );
}
