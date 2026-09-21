import { WorkerEntrypoint } from "cloudflare:workers";

/**
 * メインアプリ（canshi）の `src/worker.ts` が export する `McpRpc` と対応する
 * RPC 契約の型。Service Bindings（`env.MAIN_APP`）越しに呼び出せるメソッドの
 * シグネチャをここで手動的に宣言する。
 *
 * パッケージ境界をまたいで `McpRpc` の実装を直接 import すると、メインアプリ側の
 * Next.js 向け tsconfig・パスエイリアス（`@/*`）・生成済み型（`worker-configuration.d.ts`）
 * に連鎖的に依存してしまい、このパッケージの独立した型検査が壊れやすくなる。そのため
 * 実装は import せず、契約だけをここに複製する。メインアプリの `McpRpc` の
 * メソッドを追加・変更したら、このファイルも合わせて更新すること
 */
export interface CatSummary {
  id: string;
  name: string;
}

export abstract class MainAppRpc extends WorkerEntrypoint<unknown> {
  abstract listCats(): Promise<CatSummary[]>;
}
