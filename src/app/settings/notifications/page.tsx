import Link from "next/link";
import { TbChevronRight, TbClock, TbDeviceMobile, TbPaw } from "react-icons/tb";
import { Alert, Breadcrumb, ButtonLink } from "@/components/ui";
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

      <header className={styles.header}>
        <RecordPageHeading icon={NotificationSettingsIcon}>
          通知設定
        </RecordPageHeading>
        <p className={styles.description}>
          この端末での受け取り方と、猫ごとのお知らせを設定できます。
        </p>
      </header>

      <Alert color="info" aria-label="通知が届く時間">
        <TbClock
          className={`${styles.sectionIcon} ${styles.scheduleIcon}`}
          aria-hidden="true"
        />
        <div>
          <p className={styles.scheduleTitle}>
            お知らせは毎日 <strong>18:00</strong>（日本時間）に届きます。
          </p>
          <p>掃除記録は、対象ごとに通知時刻を指定することもできます。</p>
        </div>
      </Alert>

      <Surface
        title={
          <span className={styles.sectionTitle}>
            <TbDeviceMobile className={styles.sectionIcon} aria-hidden="true" />
            この端末での通知
          </span>
        }
      >
        <p className={styles.sectionDescription}>
          通知の受け取りは、お使いの端末ごとに設定してください。
        </p>
        <PushSubscriptionToggle />
      </Surface>

      <Surface
        className={styles.catSection}
        title={
          <span className={styles.sectionTitle}>
            <TbPaw className={styles.sectionIcon} aria-hidden="true" />
            猫ごとの通知設定
          </span>
        }
      >
        <p className={styles.sectionDescription}>
          記念日やお手入れのお知らせを、猫ごとに設定できます。
        </p>
        {cats.length === 0 ? (
          <div className={styles.emptyState}>
            <TbPaw size={32} aria-hidden="true" />
            <p>まだ猫が登録されていません。</p>
            <ButtonLink href="/cats/new" variant="secondary">
              猫を登録する
            </ButtonLink>
          </div>
        ) : (
          <ul className={styles.catList}>
            {cats.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/cats/${cat.id}/notification-settings`}
                  className={styles.catLink}
                >
                  <CatAvatar
                    className={styles.catAvatar}
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
