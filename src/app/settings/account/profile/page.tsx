import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { AccountSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { updateUserProfileAction } from "@/features/users/actions";
import { UserProfileForm } from "@/features/users/UserProfileForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "プロフィールを編集する | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const user = await requireUser();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "アカウント設定", href: "/settings/account" },
          { label: "プロフィールを編集する" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AccountSettingsIcon}>
          プロフィールを編集する
        </RecordPageHeading>
        <p className={styles.description}>
          あなたの名前とアイコンを変更できます。
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
