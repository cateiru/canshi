// `wrangler types` は Service Bindings の RPC メソッドまでは型付けできず、
// `MAIN_APP` は素の `Service`（メソッド無し）として生成される
// （worker-configuration.d.ts 内のコメント参照）。`src/rpc/mainApp.ts` に手動で
// 複製した RPC 契約の型（`MainAppRpc`）を使い、呼び出し可能なメソッドを型検査する
import type { MainAppRpc } from "./src/rpc/mainApp";

declare global {
  interface Env {
    MAIN_APP: Service<MainAppRpc>;
    // `ACCESS_DISCOVERY_URL` は機密情報ではないため `wrangler.jsonc` の `vars` で
    // 設定する。それ以外は `wrangler secret put` / `.dev.vars` で設定する値。
    // `wrangler types` はどちらも検出できないため、メインアプリの env.d.ts と
    // 同じパターンで型を補う。
    // Access for SaaS の authorization/token endpoint・JWKS（Key endpoint）・
    // issuer は Team domain 共通ではなく SaaS アプリ（ACCESS_CLIENT_ID）ごとに
    // 異なるが、discovery ドキュメント（ACCESS_DISCOVERY_URL）自体がそのアプリ用の
    // 値を返すため、他は discovery から導出する（src/auth/discovery.ts 参照）
    ACCESS_DISCOVERY_URL: string;
    ACCESS_CLIENT_ID: string;
    ACCESS_CLIENT_SECRET: string;
    OAUTH_STATE_SECRET: string;
  }
}
