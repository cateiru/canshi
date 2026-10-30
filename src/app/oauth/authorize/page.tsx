import type { Metadata } from "next";
import { headers } from "next/headers";
import { TbAlertTriangle, TbEye, TbUser } from "react-icons/tb";
import { Alert, Button, Heading } from "@/components/ui";
import { AiConnectionIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { getMcpClientIcon } from "@/features/mcp/clientIcons";
import {
  decodeMcpConsentRequest,
  formatRedirectUri,
  MCP_CONSENT_HEADER,
} from "@/features/mcp/consent";
import { McpPermissionTreeField } from "@/features/mcp/McpPermissionTreeField";
import { getMcpPermissionTree } from "@/features/mcp/permissions";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "AIとの接続 | CANSHI",
  // 認可リクエストの URL（state など）を外部の遷移先へ送らない。`no-referrer` にすると
  // 同意ボタンの POST に `Origin: null` が付き、Worker の Origin の確認で拒否されてしまう
  referrer: "same-origin",
};

export const dynamic = "force-dynamic";

type AuthorizePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * ChatGPT などの MCP クライアントを接続するときの同意画面。認可リクエストの検証と、
 * 「許可する」「許可しない」の送信先（`POST /oauth/authorize`）の処理は Worker
 * （`src/features/mcp/authorize.ts`）が行い、このページは検証済みの内容と、この接続で
 * 読み取り・書き込みを許可する範囲の選択を表示するだけ。
 * 未ログインのときは middleware がログイン画面へ送り、ログイン後にこのページへ戻る
 */
export default async function AuthorizePage({
  searchParams,
}: AuthorizePageProps) {
  const user = await requireUser();
  const consent = decodeMcpConsentRequest(
    (await headers()).get(MCP_CONSENT_HEADER),
  );
  // 同じアプリに前回同意したときの範囲があれば、それを初期の状態にする
  const permissionTree = consent
    ? await getMcpPermissionTree(user.id, consent.clientId)
    : null;
  const ClientIcon = getMcpClientIcon(consent?.redirectUri ?? null);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <RecordPageHeading icon={AiConnectionIcon}>
          AIとの接続
        </RecordPageHeading>
        <p className={styles.description}>
          接続するアプリと、許可する範囲を確認してください。
        </p>
      </header>

      {consent && permissionTree ? (
        <>
          <Surface
            className={styles.connection}
            aria-labelledby="connecting-app"
          >
            <div className={styles.app}>
              <span className={styles.appIcon}>
                <ClientIcon size={28} aria-hidden="true" />
              </span>
              <div className={styles.appIdentity}>
                <p className={styles.note}>接続をリクエストしているアプリ</p>
                <Heading level={2} size="lg" id="connecting-app">
                  {consent.clientName ?? "（名前がありません）"}
                </Heading>
                <p className={styles.note}>アプリ自身が申告した名前です。</p>
              </div>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>接続先</dt>
                <dd>{formatRedirectUri(consent.redirectUri)}</dd>
              </div>
              <div>
                <dt>接続に使うアカウント</dt>
                <dd className={styles.account}>
                  <TbUser size={18} aria-hidden="true" />
                  {user.name} さん
                </dd>
              </div>
            </dl>
          </Surface>
          <p className={styles.caution}>
            <TbAlertTriangle size={20} aria-hidden="true" />
            自分で接続を始めたのでなければ、許可しないでください。
          </p>
          <form
            method="post"
            action={`/oauth/authorize?${toQueryString(await searchParams)}`}
            className={styles.form}
          >
            <Surface
              title="許可する範囲"
              titleId="ai-permissions"
              titleSize="lg"
              icon={<TbEye size={22} aria-hidden="true" />}
              gap="sm"
            >
              <p className={styles.note}>
                このアプリに公開する家・猫・記録を「読む」で選んでください。チェックを外した情報は読み取れません。記録の追加・編集を許可するときは「書く」に、ごはん商品・プリセットの操作を許可するときは家ごとの操作にチェックしてください。
              </p>
              <McpPermissionTreeField
                tree={permissionTree.households}
                catalogOperations={permissionTree.catalogOperations}
              />
              <p className={styles.note}>
                あとから登録した猫や、新しく参加した家は、読み取れますが書き込めません。
              </p>
            </Surface>
            <p className={styles.afterNote}>
              許可したあとも、設定の「AIとの接続」で範囲の変更や接続の解除ができます。
            </p>
            <div className={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                name="decision"
                value="approve"
              >
                許可する
              </Button>
              <Button type="submit" name="decision" value="deny">
                許可しない
              </Button>
            </div>
          </form>
        </>
      ) : (
        <Alert color="error">
          接続のリクエストが正しくありません。接続するアプリから、もう一度やり直してください。
        </Alert>
      )}
    </main>
  );
}

/** 同意画面を開いたときのクエリを、送信先（`POST /oauth/authorize`）でもう一度検証できるよう戻す */
function toQueryString(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }
  return query.toString();
}
