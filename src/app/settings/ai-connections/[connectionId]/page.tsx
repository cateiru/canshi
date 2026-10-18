import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TbEye } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { AiConnectionIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { updateMcpPermissionsAction } from "@/features/mcp/actions";
import { getUserMcpConnection } from "@/features/mcp/connections";
import { formatRedirectUri } from "@/features/mcp/consent";
import { McpAccessNotice } from "@/features/mcp/McpAccessNotice";
import { McpPermissionsForm } from "@/features/mcp/McpPermissionsForm";
import { getMcpPermissionTree } from "@/features/mcp/permissions";
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
 * 最後に使った日時の記録が無いときの表示。記録を始める前から使っている接続も
 * 含まれるため、まだ使っていないとは書かない
 */
const NO_LAST_USED_AT = "記録がありません";

type AiConnectionPageProps = {
  params: Promise<{ connectionId: string }>;
};

/**
 * AI との接続の 1 つについて、そのアプリから読み取れる範囲を設定するページ。
 * 範囲は接続（OAuth のクライアント）ごとで、同意画面（`/oauth/authorize`）で選んだものを
 * 変えられる。ほかのユーザーの接続・解除した接続は表示しない
 */
export default async function AiConnectionPage({
  params,
}: AiConnectionPageProps) {
  const { connectionId } = await params;
  const user = await requireUser();
  const connection = await getUserMcpConnection(user.id, connectionId);
  if (!connection) {
    notFound();
  }
  const permissionTree = await getMcpPermissionTree(
    user.id,
    connection.clientId,
  );
  const clientName = connection.clientName ?? UNNAMED_CLIENT;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "AIとの接続", href: "/settings/ai-connections" },
          { label: clientName },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AiConnectionIcon}>
          {clientName}
        </RecordPageHeading>
        <p className={styles.description}>
          このアプリから読み取れる情報を設定します。
        </p>
      </header>

      <Surface className={styles.summary} aria-label="接続の情報">
        <dl className={styles.details}>
          {connection.redirectUri ? (
            <>
              <dt>接続先</dt>
              <dd>{formatRedirectUri(connection.redirectUri)}</dd>
            </>
          ) : null}
          <dt>接続日時</dt>
          <dd>{formatDateTimeUtc(getNaiveUtcNow(connection.createdAt))}</dd>
          <dt>最終接続日時</dt>
          <dd>
            {connection.lastUsedAt
              ? formatDateTimeUtc(getNaiveUtcNow(connection.lastUsedAt))
              : NO_LAST_USED_AT}
          </dd>
        </dl>
        <p className={styles.description}>
          アプリの名前は、アプリ自身が申告したものです。
        </p>
        <McpAccessNotice />
      </Surface>

      <Surface
        title="読み取りを許可する範囲"
        titleId="ai-permissions"
        titleSize="lg"
        icon={<TbEye aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.description}>
          チェックを外した家・猫・記録は、このアプリから読み取れなくなります。ほかのアプリとの接続には影響しません。
        </p>
        <p className={styles.description}>
          あとから登録した猫や、新しく参加した家は、読み取れる状態になります。
        </p>
        <McpPermissionsForm
          action={updateMcpPermissionsAction.bind(null, connection.id)}
          tree={permissionTree}
        />
      </Surface>
    </main>
  );
}
