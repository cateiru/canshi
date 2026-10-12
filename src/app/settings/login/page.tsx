import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Badge, Breadcrumb, Button } from "@/components/ui";
import { LoginSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { logoutAction } from "@/features/auth/actions";
import { formatDeviceName } from "@/features/auth/deviceName";
import { LogoutAllDevicesButton } from "@/features/auth/LogoutAllDevicesButton";
import { SessionLogoutButton } from "@/features/auth/SessionLogoutButton";
import { requireUser } from "@/features/auth/session";
import { listUserSessions } from "@/features/auth/sessions";
import { SESSION_COOKIE_NAME } from "@/features/auth/sessionToken";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン設定 | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function LoginSettingsPage() {
  const user = await requireUser();
  const sessions = await listUserSessions(
    user.id,
    (await cookies()).get(SESSION_COOKIE_NAME)?.value,
  );

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
          ログインしているアカウントと端末の確認と、ログアウトができます。
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

      <Surface title="ログイン中の端末" titleId="login-sessions" gap="sm">
        <p className={styles.sectionDescription}>
          このアカウントでログインしている端末です。心当たりのない端末や、使わなくなった端末はログアウトできます。
        </p>
        <ul className={styles.sessions}>
          {sessions.map((session) => {
            const deviceName = formatDeviceName(session.userAgent);
            const loggedInAt = formatDateTimeUtc(
              getNaiveUtcNow(session.createdAt),
            );
            return (
              <li key={session.id} className={styles.session}>
                <div className={styles.sessionInfo}>
                  <span className={styles.deviceName}>
                    {deviceName}
                    {session.isCurrent ? (
                      <Badge color="accent">この端末</Badge>
                    ) : null}
                  </span>
                  <span className={styles.loggedInAt}>
                    ログイン日時: {loggedInAt}
                  </span>
                </div>
                {session.isCurrent ? null : (
                  <SessionLogoutButton
                    sessionId={session.id}
                    deviceName={deviceName}
                    loggedInAt={loggedInAt}
                  />
                )}
              </li>
            );
          })}
        </ul>
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
