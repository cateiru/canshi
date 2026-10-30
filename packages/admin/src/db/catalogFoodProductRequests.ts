import type { AdminDb } from "./queries";

/**
 * 共通のごはん商品のリクエスト（`catalog_food_product_requests`）の一覧と、完了の処理。
 * メインアプリのスキーマは import しないため（`queries.ts` の冒頭を参照）、生の SQL で書く。
 * 完了の処理はメインアプリの MCP（`src/features/catalog-food-products/requests.ts` の
 * `completeCatalogFoodProductRequest`）と同じ通知を作るため、文言・重複を防ぐキーを揃えること
 */

/** 完了にしたリクエストを一覧に表示する件数の上限 */
export const COMPLETED_REQUEST_LIST_LIMIT = 50;

export interface CatalogFoodProductRequest {
  id: string;
  userName: string;
  /** 検索ページの URL のクエリ（`q=...&textureType=...`） */
  searchQuery: string;
  /** 検索条件の要約（リクエストしたときにメインアプリが作ったもの） */
  label: string;
  createdAt: Date;
  completedAt: Date | null;
}

type RequestRow = {
  id: string;
  user_name: string;
  search_query: string;
  label: string;
  created_at: number;
  completed_at: number | null;
};

function toRequest(row: RequestRow): CatalogFoodProductRequest {
  return {
    id: row.id,
    userName: row.user_name,
    searchQuery: row.search_query,
    label: row.label,
    createdAt: new Date(row.created_at * 1000),
    completedAt:
      row.completed_at === null ? null : new Date(row.completed_at * 1000),
  };
}

const SELECT_REQUESTS_SQL = `
SELECT r.id, u.name AS user_name, r.search_query, r.label, r.created_at, r.completed_at
FROM catalog_food_product_requests r
JOIN users u ON u.id = r.user_id`;

/**
 * リクエストの一覧。対応を待っているものは古い順（待っている時間が長い順）にすべて、完了にしたものは
 * 完了にした日時の新しい順に `COMPLETED_REQUEST_LIST_LIMIT` 件まで返す
 */
export async function listCatalogFoodProductRequests(db: AdminDb): Promise<{
  open: CatalogFoodProductRequest[];
  completed: CatalogFoodProductRequest[];
}> {
  const [open, completed] = await db.batch([
    db.prepare(
      `${SELECT_REQUESTS_SQL}
      WHERE r.completed_at IS NULL
      ORDER BY r.created_at, r.rowid`,
    ),
    db
      .prepare(
        `${SELECT_REQUESTS_SQL}
        WHERE r.completed_at IS NOT NULL
        ORDER BY r.completed_at DESC, r.rowid DESC
        LIMIT ?1`,
      )
      .bind(COMPLETED_REQUEST_LIST_LIMIT),
  ]);
  return {
    open: (open.results as RequestRow[]).map(toRequest),
    completed: (completed.results as RequestRow[]).map(toRequest),
  };
}

/**
 * リクエストを完了にしたときに、リクエストしたユーザーへ送る通知の文言と URL。メインアプリの
 * `catalogRequestCompletedMessage`（`src/features/catalog-food-products/requests.ts`）と同じにする
 */
export function completedNotificationMessage(request: {
  searchQuery: string;
  label: string;
}) {
  return {
    title: "共通のごはん商品のリクエストに対応しました",
    body: `リクエストした検索条件（${request.label}）に対応しました。もう一度検索してみてください`,
    url: `/food-products/search?${request.searchQuery}`,
  };
}

export type CompleteRequestResult =
  | "completed"
  | "already-completed"
  | "not-found";

/**
 * リクエストを完了にし、リクエストしたユーザーへの通知（`notifications.user_id`）を作る。
 * 通知の INSERT と完了の UPDATE を同じ batch で行い、どちらも未完了のときだけ反映する。
 * 同時に完了にされても、通知は重複を防ぐキー（`catalog_request_completed:{ID}`）で 1 件にする。
 * Push はメインアプリの次のスケジュール実行で送る
 */
export async function completeCatalogFoodProductRequest(
  db: AdminDb,
  requestId: string,
): Promise<CompleteRequestResult> {
  const { results } = await db
    .prepare(
      `SELECT r.id, u.name AS user_name, r.search_query, r.label, r.created_at, r.completed_at
      FROM catalog_food_product_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ?1`,
    )
    .bind(requestId)
    .all<RequestRow>();
  const row = results[0];
  if (!row) {
    return "not-found";
  }
  if (row.completed_at !== null) {
    return "already-completed";
  }
  const message = completedNotificationMessage(toRequest(row));
  const [, updated] = await db.batch([
    db
      .prepare(
        `INSERT INTO notifications
          (id, user_id, kind, reference_id, dedupe_key, title, body, url, due_at, status)
        SELECT ?1, r.user_id, 'catalog_request_completed', r.id, ?2, ?3, ?4, ?5, unixepoch(), 'pending'
        FROM catalog_food_product_requests r
        WHERE r.id = ?6 AND r.completed_at IS NULL
        ON CONFLICT (dedupe_key) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        `catalog_request_completed:${requestId}`,
        message.title,
        message.body,
        message.url,
        requestId,
      ),
    db
      .prepare(
        `UPDATE catalog_food_product_requests
        SET completed_at = unixepoch()
        WHERE id = ?1 AND completed_at IS NULL
        RETURNING id`,
      )
      .bind(requestId),
  ]);
  return updated.results.length > 0 ? "completed" : "already-completed";
}
