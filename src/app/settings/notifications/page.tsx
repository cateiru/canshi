import { Breadcrumb, Card, Heading } from "@/components/ui";
import { PushSubscriptionToggle } from "@/features/push/PushSubscriptionToggle";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function NotificationSettingsPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/" }, { label: "通知設定" }]}
      />

      <h1>通知設定</h1>

      <Card>
        <Heading level={2} size="md">
          この端末での通知
        </Heading>
        <PushSubscriptionToggle />
      </Card>
    </main>
  );
}
