import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * `d1` を渡すと、それを使って `drizzle` インスタンスを作る。
 * 省略時は `getCloudflareContext()` からリクエストスコープの `D1Database` を取る（従来どおり）。
 *
 * `getCloudflareContext()` は Next.js のリクエスト処理でだけ有効な `AsyncLocalStorage` に
 * 依存しており、Cloudflare Workflows のステップ内（`src/workflows/notification.ts`）のように
 * リクエスト外で呼ぶと例外になる。そのため Workflow は自身の `env.DB` を明示的に渡す
 */
export function getDb(d1?: D1Database) {
  if (d1) {
    return drizzle(d1, { schema });
  }
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
