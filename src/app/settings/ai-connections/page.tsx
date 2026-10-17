import type { Metadata } from "next";
import { TbEye, TbPlugConnected } from "react-icons/tb";
import { Breadcrumb, ButtonLink, Heading } from "@/components/ui";
import { AiConnectionIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { listUserMcpConnections } from "@/features/mcp/connections";
import { formatRedirectUri } from "@/features/mcp/consent";
import { McpAccessNotice } from "@/features/mcp/McpAccessNotice";
import { RevokeMcpConnectionButton } from "@/features/mcp/RevokeMcpConnectionButton";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
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
          接続しているアプリの確認や解除、アプリごとに読み取れる情報の設定ができます。
        </p>
      </header>

      <McpAccessNotice />

      <section className={styles.section} aria-labelledby="ai-connections">
        <div className={styles.sectionHeader}>
          <Heading level={2} size="lg" id="ai-connections">
            接続しているアプリ
          </Heading>
          <span className={styles.count}>{connections.length}件</span>
        </div>
        {connections.length === 0 ? (
          <Surface className={styles.empty}>
            <span className={styles.appIcon}>
              <TbPlugConnected size={28} aria-hidden="true" />
            </span>
            <Heading level={3} size="md">
              接続しているアプリはありません
            </Heading>
            <p className={styles.description}>
              ChatGPT など、接続したい AI のアプリから CANSHI
              への接続を始めてください。
            </p>
          </Surface>
        ) : (
          <>
            <p className={styles.sectionDescription}>
              心当たりのない接続や、使わなくなった接続は解除してください。
            </p>
            <ul className={styles.connections}>
              {connections.map((connection) => {
                const clientName = connection.clientName ?? UNNAMED_CLIENT;
                const connectedAtUtc = getNaiveUtcNow(connection.createdAt);
                const connectedAt = formatDateTimeUtc(connectedAtUtc);
                return (
                  <li key={connection.id}>
                    <Surface
                      className={styles.connection}
                      aria-label={`${clientName}との接続`}
                    >
                      <div className={styles.app}>
                        <span className={styles.appIcon}>
                          <TbPlugConnected size={28} aria-hidden="true" />
                        </span>
                        <div className={styles.identity}>
                          <Heading level={3} size="lg">
                            {clientName}
                          </Heading>
                          <p className={styles.description}>
                            アプリ自身が申告した名前です。
                          </p>
                        </div>
                      </div>
                      <dl className={styles.details}>
                        {connection.redirectUri ? (
                          <div>
                            <dt>接続先</dt>
                            <dd>{formatRedirectUri(connection.redirectUri)}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt>接続日時</dt>
                          <dd>{connectedAt}</dd>
                        </div>
                      </dl>
                      <div className={styles.actions}>
                        <ButtonLink
                          href={`/settings/ai-connections/${connection.id}`}
                          leftIcon={TbEye}
                        >
                          読み取る範囲
                        </ButtonLink>
                        <RevokeMcpConnectionButton
                          connectionId={connection.id}
                          clientName={clientName}
                          connectedAt={connectedAt}
                        />
                      </div>
                    </Surface>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
