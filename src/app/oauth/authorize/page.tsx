import type { Metadata } from "next";
import { headers } from "next/headers";
import { Alert, Button } from "@/components/ui";
import { AiConnectionIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import {
  decodeMcpConsentRequest,
  formatRedirectUri,
  MCP_CONSENT_HEADER,
} from "@/features/mcp/consent";
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
 * （`src/features/mcp/authorize.ts`）が行い、このページは検証済みの内容を表示するだけ。
 * 未ログインのときは middleware がログイン画面へ送り、ログイン後にこのページへ戻る
 */
export default async function AuthorizePage({
  searchParams,
}: AuthorizePageProps) {
  const user = await requireUser();
  const consent = decodeMcpConsentRequest(
    (await headers()).get(MCP_CONSENT_HEADER),
  );

  return (
    <main className={styles.main}>
      <RecordPageHeading icon={AiConnectionIcon}>AIとの接続</RecordPageHeading>

      {consent ? (
        <Surface className={styles.content}>
          <p>
            外部のアプリが、<strong>{user.name}</strong>
            さんのアカウントで CANSHI
            に接続しようとしています。許可すると、このアプリから、あなたが所属する家の猫のプロフィールと記録を読み取れるようになります（記録の追加・変更はできません）。許可した接続は、設定の「AIとの接続」から解除できます。
          </p>
          <dl className={styles.details}>
            <dt>アプリの名前</dt>
            <dd>{consent.clientName ?? "（名前がありません）"}</dd>
            <dt>接続先</dt>
            <dd>{formatRedirectUri(consent.redirectUri)}</dd>
          </dl>
          <p className={styles.note}>
            アプリの名前は接続するアプリ自身が名乗っているものです。自分で接続を始めたのでなければ、許可しないでください。
          </p>
          <form
            method="post"
            action={`/oauth/authorize?${toQueryString(await searchParams)}`}
            className={styles.actions}
          >
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
          </form>
        </Surface>
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
