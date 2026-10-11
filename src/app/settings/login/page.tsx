import type { Metadata } from "next";
import { Breadcrumb, Button } from "@/components/ui";
import { LoginSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { logoutAction } from "@/features/auth/actions";
import { LogoutAllDevicesButton } from "@/features/auth/LogoutAllDevicesButton";
import { requireUser } from "@/features/auth/session";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン設定 | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function LoginSettingsPage() {
  const user = await requireUser();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ログイン設定" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={LoginSettingsIcon}>
          ログイン設定
        </RecordPageHeading>
        <p className={styles.description}>
          ログインしているアカウントの確認と、ログアウトができます。
        </p>
      </header>

      <Surface title="ログイン中のアカウント" titleId="login-account" gap="sm">
        <dl className={styles.account}>
          <dt>ユーザー ID</dt>
          <dd>
            <code className={styles.userId}>{user.id}</code>
          </dd>
        </dl>
      </Surface>

      <Surface title="ログアウト" titleId="logout" gap="md">
        <div className={styles.logoutItem}>
          <p className={styles.sectionDescription}>
            この端末からログアウトします。
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="primary">
              ログアウト
            </Button>
          </form>
        </div>
        <div className={styles.logoutItem}>
          <p className={styles.sectionDescription}>
            この端末を含め、ログインしているすべての端末からログアウトします。端末をなくしたときなどに使ってください。
          </p>
          <div>
            <LogoutAllDevicesButton />
          </div>
        </div>
      </Surface>
    </main>
  );
}
