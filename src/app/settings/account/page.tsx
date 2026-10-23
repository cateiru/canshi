import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TbDevices, TbLogout, TbPencil } from "react-icons/tb";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Table,
  TableActionCell,
  TableActionHeader,
} from "@/components/ui";
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
import { UserAvatar } from "@/features/users/UserAvatar";
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
          あなたのプロフィールの確認と編集、ログインしている端末の確認とログアウトができます。
        </p>
      </header>

      <Surface aria-label="プロフィール" className={styles.profile}>
        <UserAvatar
          name={user.name}
          iconMediaAssetId={user.iconMediaAssetId}
          size="md"
        />
        <dl className={styles.profileDetails}>
          <dt className={styles.srOnly}>名前</dt>
          <dd className={styles.userName}>{user.name}</dd>
          <dt className={styles.srOnly}>ユーザー ID</dt>
          <dd>
            <code className={styles.userId}>{user.id}</code>
          </dd>
        </dl>
        <ButtonLink
          href="/settings/account/profile"
          leftIcon={TbPencil}
          className={styles.editButton}
        >
          編集
        </ButtonLink>
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
        <Table aria-labelledby="login-sessions">
          <thead>
            <tr>
              <th scope="col">端末</th>
              <th scope="col">ログイン日時</th>
              <TableActionHeader />
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
                  <TableActionCell>
                    {session.isCurrent ? null : (
                      <SessionLogoutButton
                        sessionId={session.id}
                        deviceName={deviceName}
                        loggedInAt={loggedInAt}
                      />
                    )}
                  </TableActionCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
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
