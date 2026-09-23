import { Breadcrumb } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { PushSubscriptionToggle } from "@/features/push/PushSubscriptionToggle";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function NotificationSettingsPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "通知設定" },
        ]}
      />

      <RecordPageHeading icon={NotificationSettingsIcon}>
        通知設定
      </RecordPageHeading>
      <p>
        お知らせは毎日
        18:00（日本時間）に届きます。掃除記録は、対象ごとに通知時刻を指定することもできます。
      </p>

      <Surface title="この端末での通知">
        <PushSubscriptionToggle />
      </Surface>
    </main>
  );
}
