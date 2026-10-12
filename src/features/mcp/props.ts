/**
 * MCP の認可（`/oauth/authorize` の同意）で `completeAuthorization()` の `props` に
 * 渡す値と対応する。トークンに暗号化して保存され、Durable Object 上で `this.props` として
 * ツール実装から参照できる
 */
export interface McpProps extends Record<string, unknown> {
  /** 同意したときにログインしていた CANSHI のユーザー ID */
  userId?: string;
}

/** ユーザー ID を持たないトークンでツールを呼んだときのエラー */
export const MISSING_USER_ERROR_MESSAGE =
  "この接続にはユーザー情報が含まれていません。MCP のコネクタを一度削除して、接続し直してください";

/** トークンの `props` から CANSHI のユーザー ID を取り出す。無ければ null */
export function getUserIdFromProps(props: McpProps | undefined) {
  return props?.userId ? props.userId : null;
}
