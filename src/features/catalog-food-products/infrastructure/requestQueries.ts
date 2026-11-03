import { asc, desc, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProductRequests } from "@/db/schema";

/** MCP の一覧で返す件数の上限 */
export const CATALOG_REQUEST_LIST_LIMIT = 50;

/**
 * リクエストの一覧。未完了は古い順（待っている時間が長い順）、完了は完了にした日時の新しい順に
 * `CATALOG_REQUEST_LIST_LIMIT` 件まで返す。リクエストしたユーザーは返さない
 */
export async function listCatalogFoodProductRequests(
  status: "open" | "completed",
  d1?: D1Database,
) {
  const rows = await getDb(d1)
    .select({
      id: catalogFoodProductRequests.id,
      searchQuery: catalogFoodProductRequests.searchQuery,
      label: catalogFoodProductRequests.label,
      createdAt: catalogFoodProductRequests.createdAt,
      completedAt: catalogFoodProductRequests.completedAt,
    })
    .from(catalogFoodProductRequests)
    .where(
      status === "open"
        ? isNull(catalogFoodProductRequests.completedAt)
        : isNotNull(catalogFoodProductRequests.completedAt),
    )
    .orderBy(
      ...(status === "open"
        ? [asc(catalogFoodProductRequests.createdAt), asc(sql`rowid`)]
        : [desc(catalogFoodProductRequests.completedAt), desc(sql`rowid`)]),
    )
    .limit(CATALOG_REQUEST_LIST_LIMIT + 1);
  return {
    items: rows.slice(0, CATALOG_REQUEST_LIST_LIMIT),
    hasMore: rows.length > CATALOG_REQUEST_LIST_LIMIT,
  };
}
