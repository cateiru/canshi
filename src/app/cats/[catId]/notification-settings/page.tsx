import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { NotificationSettingsForm } from "@/features/notifications/NotificationSettingsForm";
import { updateCatNotificationSettingsAction } from "@/features/notifications/settingsActions";
import { getCatNotificationSettingsPageData } from "@/features/notifications/settingsQueries";
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
  const cat = await getCatById(catId);

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
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "通知設定" },
        ]}
      />

      <RecordPageHeading icon={NotificationSettingsIcon}>
        {cat.name}の通知設定
      </RecordPageHeading>
      <p>この猫の記念日や、お手入れのタイミングをお知らせします。</p>

      <NotificationSettingsForm
        action={action}
        settings={settings}
        cleaningTargets={cleaningTargets}
      />
    </main>
  );
}
