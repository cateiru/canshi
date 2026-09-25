import Link from "next/link";
import { TbChevronRight } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { NotificationSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { CatAvatar } from "@/features/cats/CatAvatar";
import { listCats } from "@/features/cats/queries";
import { PushSubscriptionToggle } from "@/features/push/PushSubscriptionToggle";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const cats = await listCats();

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

      <Surface title="猫ごとの通知設定">
        <p>記念日やお手入れのお知らせを、猫ごとに設定できます。</p>
        {cats.length === 0 ? (
          <p>まだ猫が登録されていません。</p>
        ) : (
          <ul className={styles.catList}>
            {cats.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/cats/${cat.id}/notification-settings`}
                  className={styles.catLink}
                >
                  <CatAvatar
                    name={cat.name}
                    profileMediaAssetId={cat.profileMediaAssetId}
                    profileCropX={cat.profileCropX}
                    profileCropY={cat.profileCropY}
                    profileCropZoom={cat.profileCropZoom}
                    profileCropRotation={cat.profileCropRotation}
                  />
                  <span className={styles.catName}>{cat.name}</span>
                  <TbChevronRight
                    className={styles.chevron}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </main>
  );
}
