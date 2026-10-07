import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { ProfileSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { updateUserProfileAction } from "@/features/users/actions";
import { UserProfileForm } from "@/features/users/UserProfileForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "プロフィール設定 | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireUser();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "プロフィール設定" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={ProfileSettingsIcon}>
          プロフィール設定
        </RecordPageHeading>
        <p className={styles.description}>
          あなたの名前とアイコンを設定できます。
        </p>
      </header>

      <UserProfileForm
        action={updateUserProfileAction}
        defaultName={user.name}
        iconMediaAssetId={user.iconMediaAssetId}
      />
    </main>
  );
}
