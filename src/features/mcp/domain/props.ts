/**
 * MCP の認可（`/oauth/authorize` の同意）で `completeAuthorization()` の `props` に
 * 渡す値と対応する。トークンに暗号化して保存され、リクエストごとの `ctx.props` から
 * ツール実装に渡す（`./agent.ts`）
 */
export interface McpProps extends Record<string, unknown> {
  /** 同意したときにログインしていた CANSHI のユーザー ID */
  userId?: string;
  /**
   * アクセストークンの OAuth のクライアントの ID。接続ごとの読み取りの範囲
   * （`./permissions.ts`）を見分けるのに使う。トークンには保存せず、リクエストごとに
   * grant から求めて入れる（`./clientId.ts` の `withMcpClientId`）
   */
  clientId?: string;
}

/** ユーザー ID を持たないトークンでツールを呼んだときのエラー */
export const MISSING_USER_ERROR_MESSAGE =
  "この接続にはユーザー情報が含まれていません。MCP のコネクタを一度削除して、接続し直してください";

/** 接続（OAuth のクライアント）を求められなかったリクエストでツールを呼んだときのエラー */
export const MISSING_CLIENT_ERROR_MESSAGE =
  "この接続を確認できませんでした。MCP のコネクタを一度削除して、接続し直してください";

/** トークンの `props` から CANSHI のユーザー ID を取り出す。無ければ null */
export function getUserIdFromProps(props: McpProps | undefined) {
  return props?.userId ? props.userId : null;
}

/** トークンの `props` から OAuth のクライアントの ID を取り出す。無ければ null */
export function getClientIdFromProps(props: McpProps | undefined) {
  return props?.clientId ? props.clientId : null;
}
