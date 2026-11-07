import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TbEye } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import { requireUser } from "@/features/auth/presentation/session";
import { getUserMcpConnection } from "@/features/mcp/infrastructure/connections";
import { getMcpPermissionTree } from "@/features/mcp/infrastructure/permissions";
import { updateMcpPermissionsAction } from "@/features/mcp/presentation/actions";
import { getMcpClientIcon } from "@/features/mcp/presentation/clientIcons";
import { formatRedirectUri } from "@/features/mcp/presentation/consent";
import { McpPermissionsForm } from "@/features/mcp/presentation/McpPermissionsForm";
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
 * AI との接続の 1 つについて、そのアプリから読み取れる範囲と書き込める範囲を設定するページ。
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
        <RecordPageHeading icon={getMcpClientIcon(connection.redirectUri)}>
          {clientName}
        </RecordPageHeading>
        <p className={styles.description}>
          このアプリから読み取れる情報と、書き込める情報を設定します。
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
      </Surface>

      <Surface
        title="許可する範囲"
        titleId="ai-permissions"
        titleSize="lg"
        icon={<ScaledIcon icon={TbEye} aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.description}>
          チェックを入れた権限に対してAIが操作できるようになります。
        </p>
        <McpPermissionsForm
          action={updateMcpPermissionsAction.bind(null, connection.id)}
          tree={permissionTree}
        />
      </Surface>
    </main>
  );
}
