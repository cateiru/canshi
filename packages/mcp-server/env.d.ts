// `wrangler types` は Service Bindings の RPC メソッドまでは型付けできず、
// `MAIN_APP` は素の `Service`（メソッド無し）として生成される
// （worker-configuration.d.ts 内のコメント参照）。`src/rpc/mainApp.ts` に手動で
// 複製した RPC 契約の型（`MainAppRpc`）を使い、呼び出し可能なメソッドを型検査する
import type { MainAppRpc } from "./src/rpc/mainApp";

declare global {
  interface Env {
    MAIN_APP: Service<MainAppRpc>;
  }
}
