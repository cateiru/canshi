import {
  and,
  asc,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { insertWhere } from "../../../../src/db/conditionalInsert";
import type { AdminDb } from "./client";
import { catalogFoodProductRequests, notifications, users } from "./schema";

/**
 * 共通のごはん商品のリクエスト（`catalog_food_product_requests`）の一覧と、完了の処理。
 * `queries.ts` と同じく、メインアプリの Drizzle スキーマで読み書きする。
 * 完了の処理はメインアプリの MCP（`src/features/catalog-food-products/application/requests.ts` の
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

/** リクエストと、リクエストしたユーザーの名前を読む SELECT */
function selectRequests(db: AdminDb) {
  return db
    .select({
      id: catalogFoodProductRequests.id,
      userId: catalogFoodProductRequests.userId,
      userName: users.name,
      searchQuery: catalogFoodProductRequests.searchQuery,
      label: catalogFoodProductRequests.label,
      createdAt: catalogFoodProductRequests.createdAt,
      completedAt: catalogFoodProductRequests.completedAt,
    })
    .from(catalogFoodProductRequests)
    .innerJoin(users, eq(users.id, catalogFoodProductRequests.userId));
}

function toRequest({
  userId: _userId,
  ...request
}: Awaited<
  ReturnType<typeof selectRequests>
>[number]): CatalogFoodProductRequest {
  return request;
}

/** 同じ日時のリクエストを登録順に並べるための rowid */
const REQUEST_ROWID = sql`${catalogFoodProductRequests}.rowid`;

/**
 * リクエストの一覧。対応を待っているものは古い順（待っている時間が長い順）にすべて、完了にしたものは
 * 完了にした日時の新しい順に `COMPLETED_REQUEST_LIST_LIMIT` 件まで返す
 */
export async function listCatalogFoodProductRequests(db: AdminDb): Promise<{
  open: CatalogFoodProductRequest[];
  completed: CatalogFoodProductRequest[];
}> {
  const [open, completed] = await Promise.all([
    selectRequests(db)
      .where(isNull(catalogFoodProductRequests.completedAt))
      .orderBy(asc(catalogFoodProductRequests.createdAt), asc(REQUEST_ROWID)),
    selectRequests(db)
      .where(isNotNull(catalogFoodProductRequests.completedAt))
      .orderBy(
        desc(catalogFoodProductRequests.completedAt),
        desc(REQUEST_ROWID),
      )
      .limit(COMPLETED_REQUEST_LIST_LIMIT),
  ]);
  return {
    open: open.map(toRequest),
    completed: completed.map(toRequest),
  };
}

/**
 * リクエストを完了にしたときに、リクエストしたユーザーへ送る通知の文言と URL。メインアプリの
 * `catalogRequestCompletedMessage`（`src/features/catalog-food-products/application/requests.ts`）と同じにする
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
  const [row] = await selectRequests(db).where(
    eq(catalogFoodProductRequests.id, requestId),
  );
  if (!row) {
    return "not-found";
  }
  if (row.completedAt !== null) {
    return "already-completed";
  }
  const message = completedNotificationMessage(row);
  const stillOpen = and(
    eq(catalogFoodProductRequests.id, requestId),
    isNull(catalogFoodProductRequests.completedAt),
  );
  const [, updated] = await db.batch([
    insertWhere(
      db,
      notifications,
      {
        id: crypto.randomUUID(),
        userId: row.userId,
        kind: "catalog_request_completed",
        referenceId: requestId,
        dedupeKey: `catalog_request_completed:${requestId}`,
        title: message.title,
        body: message.body,
        url: message.url,
        dueAt: new Date(),
        status: "pending",
      },
      exists(
        db
          .select({ id: catalogFoodProductRequests.id })
          .from(catalogFoodProductRequests)
          .where(stillOpen),
      ),
    ).onConflictDoNothing({ target: notifications.dedupeKey }),
    db
      .update(catalogFoodProductRequests)
      .set({ completedAt: sql`(unixepoch())` })
      .where(stillOpen)
      .returning({ id: catalogFoodProductRequests.id }),
  ]);
  return updated.length > 0 ? "completed" : "already-completed";
}
