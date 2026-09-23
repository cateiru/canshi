import { Breadcrumb } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { NotificationPreferencesForm } from "@/features/notifications/NotificationPreferencesForm";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { listTimezoneOptions } from "@/features/notifications/settingsQueries";
import { PushSubscriptionToggle } from "@/features/push/PushSubscriptionToggle";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const preferences = await getNotificationPreferences();
  const timezoneOptions = listTimezoneOptions();

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
      <p>お知らせを受け取る時刻と、この端末への通知を設定します。</p>

      <Surface title="通知時刻・タイムゾーン">
        <NotificationPreferencesForm
          notifyTime={preferences.notifyTime}
          timezone={preferences.timezone}
          timezoneOptions={timezoneOptions}
        />
      </Surface>

      <Surface title="この端末での通知">
        <PushSubscriptionToggle />
      </Surface>
    </main>
  );
}
