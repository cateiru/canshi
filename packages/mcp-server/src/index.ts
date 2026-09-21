import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { authHandler } from "./auth/handler";

// MCP プロトコル本体（Streamable HTTP・ツール定義）は別 PR（35）で実装する。
// それまでは `/mcp` への到達だけを確認できる最小限のスタブを返す。
// `apiHandler` は `fetch` が必須のため、`ExportedHandler<Env>`（`fetch` が
// 任意）で型注釈せず、オブジェクトリテラルの構造的な型にそのまま委ねる
const apiHandler = {
  async fetch(): Promise<Response> {
    return new Response("Not Implemented", { status: 501 });
  },
};

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler,
  defaultHandler: authHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
