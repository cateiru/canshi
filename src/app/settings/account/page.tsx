import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TbDevices, TbKey, TbLogout } from "react-icons/tb";
import { Badge, Breadcrumb, Button } from "@/components/ui";
import { AccountSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
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
import { updateUserProfileAction } from "@/features/users/actions";
import { UserProfileForm } from "@/features/users/UserProfileForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "アカウント設定 | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
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
          { label: "アカウント設定" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AccountSettingsIcon}>
          アカウント設定
        </RecordPageHeading>
        <p className={styles.description}>
          あなたの名前とアイコンの設定、ログインしている端末の確認とログアウトができます。
        </p>
      </header>

      <UserProfileForm
        action={updateUserProfileAction}
        defaultName={user.name}
        iconMediaAssetId={user.iconMediaAssetId}
      />

      <Surface
        title="ログイン中のアカウント"
        titleId="login-account"
        titleSize="lg"
        icon={<TbKey aria-hidden="true" size={20} />}
        gap="sm"
      >
        <dl className={styles.account}>
          <dt>ユーザー ID</dt>
          <dd>
            <code className={styles.userId}>{user.id}</code>
          </dd>
        </dl>
      </Surface>

      <Surface
        title="ログイン中の端末"
        titleId="login-sessions"
        titleSize="lg"
        icon={<TbDevices aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.sectionDescription}>
          このアカウントでログインしている端末です。心当たりのない端末や、使わなくなった端末はログアウトできます。
        </p>
        <div className={styles.tableScroll}>
          <table className={styles.sessions} aria-labelledby="login-sessions">
            <thead>
              <tr>
                <th scope="col">端末</th>
                <th scope="col">ログイン日時</th>
                <th scope="col">
                  <span className={styles.srOnly}>操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const deviceName = formatDeviceName(session.userAgent);
                const loggedInAt = formatDateTimeUtc(
                  getNaiveUtcNow(session.createdAt),
                );
                return (
                  <tr key={session.id}>
                    <th scope="row" className={styles.deviceName}>
                      <span className={styles.deviceNameInner}>
                        {deviceName}
                        {session.isCurrent ? (
                          <Badge color="accent">この端末</Badge>
                        ) : null}
                      </span>
                    </th>
                    <td className={styles.loggedInAt}>{loggedInAt}</td>
                    <td className={styles.actions}>
                      {session.isCurrent ? null : (
                        <SessionLogoutButton
                          sessionId={session.id}
                          deviceName={deviceName}
                          loggedInAt={loggedInAt}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      <Surface
        title="ログアウト"
        titleId="logout"
        titleSize="lg"
        icon={<TbLogout aria-hidden="true" size={20} />}
        gap="md"
      >
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
