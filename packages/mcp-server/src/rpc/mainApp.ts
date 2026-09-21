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
  sex: "male" | "female" | "unknown";
  birthDate: string | null;
  breed: string | null;
  adoptedAt: string | null;
}

/** タイムラインの記録本体（種別ごとに項目は異なるため、構造だけを型で保証する） */
type JsonPrimitive = string | number | boolean | null | Date;
type JsonRecord = Record<
  string,
  JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive>[]
>;

export interface TimelineEntrySummary {
  id: string;
  type: string;
  occurredAt: Date;
  record: JsonRecord;
  /** 添付メディアの件数。URL は Access 保護下にあるため RPC 契約には含めない */
  mediaCount: number;
}

export interface ListTimelineOptions {
  page?: number;
  pageSize?: number;
  date?: string;
}

export interface ListTimelineResult {
  entries: TimelineEntrySummary[];
  hasMore: boolean;
}

export abstract class MainAppRpc extends WorkerEntrypoint<unknown> {
  abstract listCats(): Promise<CatSummary[]>;
  abstract getCatProfile(catId: string): Promise<CatSummary | null>;
  abstract listTimeline(
    catId: string,
    year: number,
    month: number,
    options?: ListTimelineOptions,
  ): Promise<ListTimelineResult>;
}
