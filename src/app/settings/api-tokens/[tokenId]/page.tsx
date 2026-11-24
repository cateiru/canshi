import { ApiTokenIcon } from "@canshi/shared/ui/RecordIcons";
import { ScaledIcon } from "@canshi/shared/ui/ScaledIcon";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TbEye } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getApiTokenForUser } from "@/features/api/infrastructure/queries";
import { ApiTokenExpiry } from "@/features/api/presentation/ApiTokenExpiry";
import { updateApiTokenPermissionsAction } from "@/features/api/presentation/actions";
import { API_TOKENS_PATH } from "@/features/api/presentation/paths";
import { requireUser } from "@/features/auth/presentation/session";
import { getPermissionTree } from "@/features/external-access/infrastructure/permissions";
import { PermissionsForm } from "@/features/external-access/presentation/PermissionsForm";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type ApiTokenPageProps = {
  params: Promise<{ tokenId: string }>;
};

/** title は見出しと同じくトークンの名前にする。ほかのユーザーのトークン・削除したトークンなら付けない */
export async function generateMetadata({
  params,
}: ApiTokenPageProps): Promise<Metadata> {
  const { tokenId } = await params;
  const user = await requireUser();
  const token = await getApiTokenForUser(user.id, tokenId);
  return token ? { title: token.name } : {};
}

/** 発行した API トークンの 1 つについて、読み取れる範囲と書き込める範囲を変えるページ */
export default async function ApiTokenPage({ params }: ApiTokenPageProps) {
  const { tokenId } = await params;
  const user = await requireUser();
  const token = await getApiTokenForUser(user.id, tokenId);
  if (!token) {
    notFound();
  }
  const tree = await getPermissionTree(user.id, token.permissions);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "外部接続", href: "/settings/external-connections" },
          { label: "APIトークン", href: API_TOKENS_PATH },
          { label: token.name },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={ApiTokenIcon}>{token.name}</RecordPageHeading>
        <p className={styles.description}>
          このトークンで読み取れる情報と、書き込める情報を設定します。変更はすぐに反映されます。
        </p>
      </header>

      <Surface className={styles.summary} aria-label="トークンの情報">
        <dl className={styles.details}>
          <dt>有効期限</dt>
          <dd>
            <ApiTokenExpiry expiresAt={token.expiresAt} now={new Date()} />
          </dd>
          <dt>最終利用日時</dt>
          <dd>
            {token.lastUsedAt
              ? formatDateTimeUtc(getNaiveUtcNow(token.lastUsedAt))
              : "まだ使われていません"}
          </dd>
          <dt>発行日時</dt>
          <dd>{formatDateTimeUtc(getNaiveUtcNow(token.createdAt))}</dd>
        </dl>
      </Surface>

      <Surface
        title="許可する範囲"
        titleId="api-token-permissions"
        titleSize="lg"
        icon={<ScaledIcon icon={TbEye} aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.description}>
          チェックを入れた権限だけを、このトークンで使えます。
        </p>
        <PermissionsForm
          action={updateApiTokenPermissionsAction.bind(null, token.id)}
          tree={tree}
          subject="このトークン"
        />
      </Surface>
    </main>
  );
}
