import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getCatNotificationSettingsPageData } from "@/features/notifications/infrastructure/settingsQueries";
import { NotificationSettingsForm } from "@/features/notifications/presentation/NotificationSettingsForm";
import { updateCatNotificationSettingsAction } from "@/features/notifications/presentation/settingsActions";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type NotificationSettingsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function CatNotificationSettingsPage({
  params,
}: NotificationSettingsPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const { settings, cleaningTargets } =
    await getCatNotificationSettingsPageData(catId);
  const action = updateCatNotificationSettingsAction.bind(
    null,
    catId,
    cleaningTargets.map((target) => target.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "通知設定", href: "/settings/notifications" },
          { label: cat.name },
        ]}
      />

      <RecordPageHeading icon={NotificationSettingsIcon}>
        {cat.name}の通知設定
      </RecordPageHeading>
      <p>
        この猫の記念日や、お手入れのタイミング、長引いている症状をお知らせします。
      </p>

      <NotificationSettingsForm
        action={action}
        settings={settings}
        cleaningTargets={cleaningTargets}
      />
    </main>
  );
}
