import type {
  TokenExchangeCallbackOptions,
  TokenExchangeCallbackResult,
} from "@cloudflare/workers-oauth-provider";

/**
 * MCP の認可（`/oauth/authorize` の同意）で `completeAuthorization()` の `props` に
 * 渡す値と対応する。トークンに暗号化して保存され、Durable Object 上で `this.props` として
 * ツール実装から参照できる
 */
export interface McpProps extends Record<string, unknown> {
  /** 同意したときにログインしていた CANSHI のユーザー ID */
  userId?: string;
  /**
   * 同意した OAuth のクライアントの ID。接続ごとの読み取りの範囲（`./permissions.ts`）を
   * 見分けるのに使う。範囲の設定を追加する前に発行されたトークンには無い
   */
  clientId?: string;
}

/** ユーザー ID を持たないトークンでツールを呼んだときのエラー */
export const MISSING_USER_ERROR_MESSAGE =
  "この接続にはユーザー情報が含まれていません。MCP のコネクタを一度削除して、接続し直してください";

/** トークンの `props` から CANSHI のユーザー ID を取り出す。無ければ null */
export function getUserIdFromProps(props: McpProps | undefined) {
  return props?.userId ? props.userId : null;
}

/** トークンの `props` から OAuth のクライアントの ID を取り出す。無ければ null */
export function getClientIdFromProps(props: McpProps | undefined) {
  return props?.clientId ? props.clientId : null;
}

/**
 * `OAuthProvider` の `tokenExchangeCallback`。トークンを発行・更新するときに、`props` の
 * クライアントの ID を、トークンを受け取るクライアントの ID に揃える。範囲の設定を
 * 追加する前に同意した接続も、次にトークンを更新したとき（アクセストークンの有効期限は
 * 1 時間）からクライアントの ID を持つようになる。揃っていれば何も変えない
 */
export function addClientIdToProps({
  clientId,
  props,
}: TokenExchangeCallbackOptions): TokenExchangeCallbackResult | undefined {
  const current = props as McpProps | undefined;
  if (current?.clientId === clientId) {
    return undefined;
  }
  return { newProps: { ...current, clientId } satisfies McpProps };
}
