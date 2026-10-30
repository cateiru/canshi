import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * 共通のごはん商品のリクエスト（#355）。共通のごはん商品を検索して見つからなかったユーザーが、
 * その検索条件で商品の追加をお願いする。共通のごはん商品に追加するのは管理者（人）で、
 * 管理画面（`packages/admin`）か AI との接続（MCP）から完了にすると、リクエストしたユーザーに
 * 通知（`notifications.user_id`）を作る。
 *
 * 検索条件は、検索ページの URL のクエリ（`search_query`、追加先の家を除いて正規化したもの）で持ち、
 * 完了の通知から同じ条件の検索ページを開けるようにする。表示用の要約（`label`）はリクエストした
 * 時点でメインアプリが作って保存し、管理画面はそれをそのまま表示する
 * （`src/features/catalog-food-products/requests.ts`）
 */
export const catalogFoodProductRequests = sqliteTable(
  "catalog_food_product_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // 検索ページの URL のクエリ（`q=...&textureType=...`）。`toCatalogSearchQuery` で正規化した値
    searchQuery: text("search_query").notNull(),
    // 検索条件の要約（「キーワード「まぐろ」・種類：ウェット」など）
    label: text("label").notNull(),
    // 完了にした日時。NULL は未完了
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 同じユーザーが同じ条件で未完了のリクエストを重ねて作らない。完了した後は、同じ条件で
    // もう一度リクエストできる
    uniqueIndex("catalog_food_product_requests_open_unique")
      .on(table.userId, table.searchQuery)
      .where(sql`completed_at IS NULL`),
    // 管理画面・MCP の一覧で、未完了・完了ごとに日時の順に並べるため
    index("catalog_food_product_requests_completed_at_created_at_idx").on(
      table.completedAt,
      table.createdAt,
    ),
  ],
);

export type CatalogFoodProductRequest =
  typeof catalogFoodProductRequests.$inferSelect;
export type NewCatalogFoodProductRequest =
  typeof catalogFoodProductRequests.$inferInsert;
