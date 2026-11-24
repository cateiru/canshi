import { ApiTokenIcon } from "@canshi/shared/ui/RecordIcons";
import type { Metadata } from "next";
import { TbEye, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink, Heading } from "@/components/ui";
import { listApiTokensForUser } from "@/features/api/infrastructure/queries";
import { ApiTokenExpiry } from "@/features/api/presentation/ApiTokenExpiry";
import { DeleteApiTokenButton } from "@/features/api/presentation/DeleteApiTokenButton";
import { API_TOKENS_PATH } from "@/features/api/presentation/paths";
import { requireUser } from "@/features/auth/presentation/session";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "APIトークン",
};

export const dynamic = "force-dynamic";

/**
 * ログイン中のユーザーが発行した API トークンの一覧。トークンの発行（`./new`）・許可する範囲の変更
 * （`./[tokenId]`）・削除ができる。トークンそのものは保存していないため表示しない
 */
export default async function ApiTokensPage() {
  const user = await requireUser();
  const tokens = await listApiTokensForUser(user.id);
  const now = new Date();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "外部接続", href: "/settings/external-connections" },
          { label: "APIトークン" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={ApiTokenIcon}>APIトークン</RecordPageHeading>
        <p className={styles.description}>
          API
          を使うためのトークンを発行し、トークンごとに読み取れる情報と許可する操作を設定できます。
        </p>
      </header>

      <div className={styles.newAction}>
        <ButtonLink
          href={`${API_TOKENS_PATH}/new`}
          variant="primary"
          leftIcon={TbPlus}
        >
          トークンを発行する
        </ButtonLink>
      </div>

      <section className={styles.section} aria-labelledby="api-tokens">
        <div className={styles.sectionHeader}>
          <Heading level={2} size="lg" id="api-tokens">
            発行したトークン
          </Heading>
          <span className={styles.count}>{tokens.length}件</span>
        </div>
        {tokens.length === 0 ? (
          <Surface className={styles.empty}>
            <p className={styles.description}>発行したトークンはありません。</p>
          </Surface>
        ) : (
          <>
            <p className={styles.description}>
              使わなくなったトークンや、漏れたおそれのあるトークンは削除してください。
            </p>
            <ul className={styles.tokens}>
              {tokens.map((token) => {
                const createdAt = formatDateTimeUtc(
                  getNaiveUtcNow(token.createdAt),
                );
                return (
                  <li key={token.id}>
                    <Surface
                      className={styles.token}
                      aria-label={`トークン「${token.name}」`}
                    >
                      <Heading level={3} size="lg" className={styles.name}>
                        {token.name}
                      </Heading>
                      <dl className={styles.details}>
                        <div>
                          <dt>有効期限</dt>
                          <dd>
                            <ApiTokenExpiry
                              expiresAt={token.expiresAt}
                              now={now}
                            />
                          </dd>
                        </div>
                        <div>
                          <dt>最終利用日時</dt>
                          <dd>
                            {token.lastUsedAt
                              ? formatDateTimeUtc(
                                  getNaiveUtcNow(token.lastUsedAt),
                                )
                              : "まだ使われていません"}
                          </dd>
                        </div>
                        <div>
                          <dt>発行日時</dt>
                          <dd>{createdAt}</dd>
                        </div>
                      </dl>
                      <div className={styles.actions}>
                        <ButtonLink
                          href={`${API_TOKENS_PATH}/${token.id}`}
                          leftIcon={TbEye}
                        >
                          許可する範囲
                        </ButtonLink>
                        <DeleteApiTokenButton
                          tokenId={token.id}
                          tokenName={token.name}
                          createdAt={createdAt}
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
