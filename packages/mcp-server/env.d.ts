// `wrangler types` は Service Bindings の RPC メソッドまでは型付けできず、
// `MAIN_APP` は素の `Service`（メソッド無し）として生成される
// （worker-configuration.d.ts 内のコメント参照）。`src/rpc/mainApp.ts` に手動で
// 複製した RPC 契約の型（`MainAppRpc`）を使い、呼び出し可能なメソッドを型検査する
import type { MainAppRpc } from "./src/rpc/mainApp";

declare global {
  interface Env {
    MAIN_APP: Service<MainAppRpc>;
    // `wrangler secret put` / `.dev.vars` で設定する値。`wrangler types` は
    // これらを検出できないため、メインアプリの env.d.ts と同じパターンで型を補う。
    // ACCESS_TEAM_DOMAIN 等は機密情報ではないが、Access 側でアプリを作成するまで
    // 値が確定しないため、他の秘密情報と同じ経路（.dev.vars / secret）にまとめている
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_CLIENT_ID: string;
    ACCESS_CLIENT_SECRET: string;
    ACCESS_AUTHORIZATION_URL: string;
    ACCESS_TOKEN_URL: string;
    OAUTH_STATE_SECRET: string;
  }
}
