import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mcpConnectionUsages } from "@/db/schema";

/**
 * 最後に使った日時を更新する間隔（秒）。MCP のツールを呼ぶたびに D1 へ書き込まないよう、
 * 前回の記録からこれより短い間のリクエストでは更新しない
 */
export const MCP_CONNECTION_USAGE_INTERVAL_SECONDS = 60;

/**
 * 接続（OAuth のクライアント）を使った日時を記録する。`/mcp` へのリクエストごとに
 * `./clientId.ts` から呼ぶ。前回の記録から `MCP_CONNECTION_USAGE_INTERVAL_SECONDS` 以内なら
 * 更新しない。判定は UPSERT の WHERE に含め、1 文で行う
 */
export async function recordMcpConnectionUsage(
  userId: string,
  clientId: string,
  d1?: D1Database,
  now: Date = new Date(),
): Promise<void> {
  const threshold = new Date(
    now.getTime() - MCP_CONNECTION_USAGE_INTERVAL_SECONDS * 1000,
  );
  await getDb(d1)
    .insert(mcpConnectionUsages)
    .values({ userId, clientId, lastUsedAt: now })
    .onConflictDoUpdate({
      target: [mcpConnectionUsages.userId, mcpConnectionUsages.clientId],
      set: { lastUsedAt: now },
      setWhere: lt(mcpConnectionUsages.lastUsedAt, threshold),
    });
}

/** ユーザーの接続ごとの、最後に使った日時。クライアントの ID で引ける */
export async function listMcpConnectionLastUsedAt(
  userId: string,
  d1?: D1Database,
): Promise<Map<string, Date>> {
  const rows = await getDb(d1)
    .select({
      clientId: mcpConnectionUsages.clientId,
      lastUsedAt: mcpConnectionUsages.lastUsedAt,
    })
    .from(mcpConnectionUsages)
    .where(eq(mcpConnectionUsages.userId, userId));
  return new Map(rows.map((row) => [row.clientId, row.lastUsedAt]));
}

/** 接続を解除したときに、その接続を使った日時の記録を消す */
export async function deleteMcpConnectionUsage(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<void> {
  await getDb(d1)
    .delete(mcpConnectionUsages)
    .where(
      and(
        eq(mcpConnectionUsages.userId, userId),
        eq(mcpConnectionUsages.clientId, clientId),
      ),
    );
}
