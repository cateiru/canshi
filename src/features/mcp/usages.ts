import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mcpConnectionUsages } from "@/db/schema";

/**
 * 最後に使った日時を更新する間隔（秒）。MCP のツールを呼ぶたびに D1 へ書き込まないよう、
 * 前回の記録からこれより短い間のリクエストでは更新しない
 */
export const MCP_CONNECTION_USAGE_INTERVAL_SECONDS = 60;

/**
 * 接続（OAuth の grant）を使った日時を記録する。`/mcp` へのリクエストごとに
 * `./clientId.ts` から呼ぶ。前回の記録から `MCP_CONNECTION_USAGE_INTERVAL_SECONDS` 以内なら
 * 更新しない。判定は UPSERT の WHERE に含め、1 文で行う。
 *
 * grant（`grant:{userId}:{grantId}`）が期限内で残っているときだけ書き込む。
 * 記録はリクエストの処理と並んで `ctx.waitUntil` で行うため、その間に接続を解除されると、
 * 解除で消した行を作り直してしまう。解除は grant を消してからこの行を消す
 * （`./connections.ts` の `revokeUserMcpConnection`）ため、grant の確認と書き込みを
 * 1 つの文で行えば、解除の後に行が残らない
 */
export async function recordMcpConnectionUsage(
  userId: string,
  grantId: string,
  d1?: D1Database,
  now: Date = new Date(),
): Promise<void> {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const thresholdSeconds = nowSeconds - MCP_CONNECTION_USAGE_INTERVAL_SECONDS;
  // `INSERT ... SELECT` に `ON CONFLICT` を付けるときは、構文の曖昧さを避けるため
  // SELECT に WHERE が必要（`EXISTS` がそれを兼ねる）
  await getDb(d1).run(sql`
    INSERT INTO mcp_connection_usages ("user_id", "grant_id", "last_used_at")
    SELECT ${userId}, ${grantId}, ${nowSeconds}
    WHERE EXISTS (
      SELECT 1 FROM oauth_kv_entries
      WHERE "key" = ${grantKey(userId, grantId)}
        AND ("expires_at" IS NULL OR "expires_at" > ${nowSeconds})
    )
    ON CONFLICT ("user_id", "grant_id") DO UPDATE SET
      "last_used_at" = excluded."last_used_at"
    WHERE "last_used_at" < ${thresholdSeconds}
  `);
}

/** ユーザーの接続ごとの、最後に使った日時。grant の ID で引ける */
export async function listMcpConnectionLastUsedAt(
  userId: string,
  d1?: D1Database,
): Promise<Map<string, Date>> {
  const rows = await getDb(d1)
    .select({
      grantId: mcpConnectionUsages.grantId,
      lastUsedAt: mcpConnectionUsages.lastUsedAt,
    })
    .from(mcpConnectionUsages)
    .where(eq(mcpConnectionUsages.userId, userId));
  return new Map(rows.map((row) => [row.grantId, row.lastUsedAt]));
}

/** 接続を解除したときに、その接続を使った日時の記録を消す */
export async function deleteMcpConnectionUsage(
  userId: string,
  grantId: string,
  d1?: D1Database,
): Promise<void> {
  await getDb(d1)
    .delete(mcpConnectionUsages)
    .where(
      and(
        eq(mcpConnectionUsages.userId, userId),
        eq(mcpConnectionUsages.grantId, grantId),
      ),
    );
}

/**
 * grant が無くなった接続の記録を消す。定期実行で、期限切れの OAuth のデータを消した後に呼ぶ。
 * 設定から解除した接続の記録は解除と同時に消すが、同じクライアントにもう一度同意したときや
 * grant の期限が切れたときは、ライブラリや定期実行が grant だけを消すため
 */
export async function purgeOrphanedMcpConnectionUsages(
  d1?: D1Database,
): Promise<void> {
  await getDb(d1).run(sql`
    DELETE FROM mcp_connection_usages
    WHERE NOT EXISTS (
      SELECT 1 FROM oauth_kv_entries
      WHERE "key" = 'grant:' || mcp_connection_usages."user_id" || ':' || mcp_connection_usages."grant_id"
    )
  `);
}

/** ライブラリ（0.10.4）が grant を保存するキー */
function grantKey(userId: string, grantId: string) {
  return `grant:${userId}:${grantId}`;
}
