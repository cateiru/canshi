import { Breadcrumb, Card, Heading } from "@/components/ui";
import { NotificationPreferencesForm } from "@/features/notifications/NotificationPreferencesForm";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { listTimezoneOptions } from "@/features/notifications/settingsQueries";
import { PushSubscriptionToggle } from "@/features/push/PushSubscriptionToggle";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const preferences = await getNotificationPreferences();
  const timezoneOptions = listTimezoneOptions();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "通知設定" }]}
      />

      <h1>通知設定</h1>

      <Card>
        <Heading level={2} size="md">
          通知時刻・タイムゾーン
        </Heading>
        <NotificationPreferencesForm
          notifyTime={preferences.notifyTime}
          timezone={preferences.timezone}
          timezoneOptions={timezoneOptions}
        />
      </Card>

      <Card>
        <Heading level={2} size="md">
          この端末での通知
        </Heading>
        <PushSubscriptionToggle />
      </Card>
    </main>
  );
}
