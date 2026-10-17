import type { Metadata } from "next";
import Link from "next/link";
import { TbEye, TbPlugConnected } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { AiConnectionIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { listUserMcpConnections } from "@/features/mcp/connections";
import { formatRedirectUri } from "@/features/mcp/consent";
import { RevokeMcpConnectionButton } from "@/features/mcp/RevokeMcpConnectionButton";
import {
  formatDateTimeUtc,
  getNaiveUtcNow,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "AIとの接続 | CANSHI",
};

export const dynamic = "force-dynamic";

/** アプリが名前を名乗っていないときの表示 */
const UNNAMED_CLIENT = "（名前がありません）";

/**
 * ChatGPT などの AI のアプリ（MCP クライアント）に、同意画面（`/oauth/authorize`）で
 * 許可した接続の一覧。接続ごとに、読み取れる範囲の設定（`./[connectionId]`）と解除ができる
 */
export default async function AiConnectionsPage() {
  const user = await requireUser();
  const connections = await listUserMcpConnections(user.id);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "AIとの接続" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AiConnectionIcon}>
          AIとの接続
        </RecordPageHeading>
        <p className={styles.description}>
          ChatGPT などの AI
          のアプリに、あなたのアカウントでの接続を許可すると、そのアプリから猫のプロフィールと記録を読み取れるようになります。許可した接続の確認と解除、接続ごとに読み取りを許可する範囲の設定ができます。
        </p>
      </header>

      <Surface
        title="接続しているアプリ"
        titleId="ai-connections"
        titleSize="lg"
        icon={<TbPlugConnected aria-hidden="true" size={20} />}
        gap="sm"
      >
        {connections.length === 0 ? (
          <p className={styles.sectionDescription}>
            接続しているアプリはありません。
          </p>
        ) : (
          <>
            <p className={styles.sectionDescription}>
              心当たりのない接続や、使わなくなった接続は解除してください。アプリの名前は、接続したアプリ自身が名乗っているものです。
            </p>
            <div className={styles.tableScroll}>
              <table
                className={styles.connections}
                aria-labelledby="ai-connections"
              >
                <thead>
                  <tr>
                    <th scope="col">アプリ</th>
                    <th scope="col">接続日時</th>
                    <th scope="col">
                      <span className={styles.srOnly}>操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((connection) => {
                    const clientName = connection.clientName ?? UNNAMED_CLIENT;
                    const connectedAtUtc = getNaiveUtcNow(connection.createdAt);
                    const connectedAt = formatDateTimeUtc(connectedAtUtc);
                    const { date, time } = splitDateTimeUtc(connectedAtUtc);
                    return (
                      <tr key={connection.id}>
                        <th scope="row" className={styles.client}>
                          <span className={styles.clientName}>
                            {clientName}
                          </span>
                          {connection.redirectUri ? (
                            <span className={styles.redirect}>
                              {formatRedirectUri(connection.redirectUri)}
                            </span>
                          ) : null}
                          <Link
                            href={`/settings/ai-connections/${connection.id}`}
                            className={styles.permissionsLink}
                          >
                            <TbEye aria-hidden="true" />
                            読み取る範囲
                          </Link>
                        </th>
                        <td className={styles.connectedAt}>
                          {/* 狭い画面では日付と時刻の間でだけ折り返す */}
                          <span className={styles.nowrap}>{date}</span>{" "}
                          <span className={styles.nowrap}>{time}</span>
                        </td>
                        <td className={styles.actions}>
                          <RevokeMcpConnectionButton
                            connectionId={connection.id}
                            clientName={clientName}
                            connectedAt={connectedAt}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>
    </main>
  );
}
