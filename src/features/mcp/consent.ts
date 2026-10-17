/**
 * `/oauth/authorize` の同意画面（`src/app/oauth/authorize/page.tsx`）に、Worker
 * （`src/features/mcp/authorize.ts`）が検証済みの認可リクエストの内容を渡すヘッダー。
 *
 * 同意画面は Next.js のページだが、OAuth の処理（`@cloudflare/workers-oauth-provider`）は
 * `cloudflare:workers` に依存し Next.js のバンドルに含められないため、Worker 側で
 * リクエストを検証してからページへ渡す。外部から同じ名前のヘッダーを付けて
 * 偽の内容を表示させられないよう、Worker はすべてのリクエストからこのヘッダーを
 * 取り除いてから Next.js に渡す
 */
export const MCP_CONSENT_HEADER = "x-canshi-mcp-consent";

/** 同意画面に表示する、接続しようとしているクライアントの情報 */
export interface McpConsentRequest {
  /** クライアントの ID。接続の読み取りの範囲（同じクライアントに前回同意したときのもの）を表示するのに使う */
  clientId: string;
  /** クライアントが登録時に名乗った名前。自己申告のため、表示するときはそう書き添える */
  clientName: string | null;
  /** 認可コードを渡す先。クライアントに登録済みであることを確認している */
  redirectUri: string;
}

/** ヘッダーの値にする（日本語のクライアント名でも ASCII に収まるよう URI エンコードする） */
export function encodeMcpConsentRequest(request: McpConsentRequest): string {
  return encodeURIComponent(JSON.stringify(request));
}

/** ヘッダーの値を戻す。無い・形が違う場合は null */
export function decodeMcpConsentRequest(
  value: string | null,
): McpConsentRequest | null {
  if (!value) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const { clientId, clientName, redirectUri } = parsed as Record<
    string,
    unknown
  >;
  if (
    typeof clientId !== "string" ||
    clientId === "" ||
    typeof redirectUri !== "string" ||
    (clientName !== null && typeof clientName !== "string")
  ) {
    return null;
  }
  return { clientId, clientName: clientName || null, redirectUri };
}

/**
 * 認可コードの渡し先を画面に表示する形にする。http(s) はホスト名だけ、
 * それ以外（アプリのスキーム）は URI 全体を表示する
 */
export function formatRedirectUri(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.host
      : redirectUri;
  } catch {
    return redirectUri;
  }
}
