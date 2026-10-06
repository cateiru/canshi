/**
 * `/callback`（`src/auth/handler.ts`）が `completeAuthorization()` の `props` に
 * 渡す値と対応する。Durable Object 上で永続化され、`this.props` として
 * ツール実装から参照できる
 */
export interface McpProps extends Record<string, unknown> {
  email: string;
  sub: string;
  /**
   * CANSHI のユーザー ID（メインアプリの `McpRpc.resolveMcpUser` で取得）。
   * ユーザーの導入前に発行されたトークンには含まれないため optional にしている
   */
  userId?: string;
}

/** ユーザー ID を持たない（ユーザーの導入前に発行された）トークンでツールを呼んだときのエラー */
export const MISSING_USER_ERROR_MESSAGE =
  "この接続にはユーザー情報が含まれていません。MCP のコネクタを一度削除して、接続し直してください";

/** トークンの `props` から CANSHI のユーザー ID を取り出す。無ければ null */
export function getUserIdFromProps(props: McpProps | undefined) {
  return props?.userId ? props.userId : null;
}
