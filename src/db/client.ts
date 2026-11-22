import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * `d1` を渡すと、それを使って `drizzle` インスタンスを作る。
 * 省略時は `cloudflare:workers` の `env` から Worker の `D1Database` を取る。
 *
 * OpenNext の `getCloudflareContext()` は Next.js のリクエスト処理の中でしか使えなかったため、
 * Workflow・MCP からは `d1` を明示的に渡していた。`cloudflare:workers` の `env` はリクエストの
 * 外でも使えるため、今後は省略してもよい（呼び出し側の `d1` の受け渡しは残している）
 */
export function getDb(d1?: D1Database) {
  if (d1) {
    return drizzle(d1, { schema });
  }
  return drizzle(env.DB, { schema });
}
