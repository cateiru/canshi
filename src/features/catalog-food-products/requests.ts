import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProductRequests, notifications, users } from "@/db/schema";
import {
  LIFE_STAGE_LABEL,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/labels";
import { type CatalogSearchCriteria, hasAdvancedCriteria } from "./search";

/**
 * 1 人のユーザーが同時に持てる未完了のリクエストの数の上限。管理者が対応しきれないほど
 * 送られないようにする
 */
export const MAX_OPEN_CATALOG_REQUESTS = 20;

/** 検索条件を 1 つでも指定しているか。条件なしの検索ではリクエストできない */
export function hasCatalogSearchCriteria(
  criteria: CatalogSearchCriteria,
): boolean {
  return criteria.keywords.length > 0 || hasAdvancedCriteria(criteria);
}

/**
 * 検索条件を、検索ページ（`/food-products/search`）の URL のクエリにする。項目の順番を
 * 固定し、未指定の条件は含めないため、同じ条件は同じ文字列になる（リクエストの重複の判定に使う）。
 * 管理画面の完了の処理（`packages/admin/src/db/catalogFoodProductRequests.ts`）は、保存した
 * この文字列から通知の URL を作る
 */
export function toCatalogSearchQuery(criteria: CatalogSearchCriteria): string {
  const params = new URLSearchParams();
  if (criteria.keywords.length > 0) {
    params.set("q", criteria.keywords.join(" "));
  }
  for (const key of [
    "manufacturer",
    "textureType",
    "nutritionType",
    "lifeStage",
    "targetBreed",
  ] as const) {
    const value = criteria[key];
    if (value != null) {
      params.set(key, value);
    }
  }
  return params.toString();
}

/** 検索条件の要約。管理画面・通知・MCP にリクエストの内容として表示する */
export function formatCatalogSearchCriteria(
  criteria: CatalogSearchCriteria,
): string {
  const parts: string[] = [];
  if (criteria.keywords.length > 0) {
    parts.push(`キーワード：${criteria.keywords.join(" ")}`);
  }
  if (criteria.manufacturer) {
    parts.push(`メーカー名：${criteria.manufacturer}`);
  }
  if (criteria.textureType) {
    parts.push(`種類：${TEXTURE_TYPE_LABEL[criteria.textureType]}`);
  }
  if (criteria.nutritionType) {
    parts.push(`区分：${NUTRITION_TYPE_LABEL[criteria.nutritionType]}`);
  }
  if (criteria.lifeStage) {
    parts.push(`対象の猫：${LIFE_STAGE_LABEL[criteria.lifeStage]}`);
  }
  if (criteria.targetBreed) {
    parts.push(`対象の猫種：${criteria.targetBreed}`);
  }
  return parts.join("、");
}

/**
 * リクエストを完了にしたときに、リクエストしたユーザーへ送る通知の文言と URL。
 * 管理画面（`packages/admin/src/db/catalogFoodProductRequests.ts` の
 * `completedNotificationMessage`）と同じ文言にする
 */
export function catalogRequestCompletedMessage(request: {
  searchQuery: string;
  label: string;
}) {
  return {
    title: "共通のごはん商品のリクエストに対応しました",
    body: `リクエストした検索条件（${request.label}）に対応しました。もう一度検索してみてください`,
    url: `/food-products/search?${request.searchQuery}`,
  };
}

/** 通知の重複を防ぐキー。管理画面から完了にしたときも同じキーにする */
export function catalogRequestCompletedDedupeKey(requestId: string) {
  return `catalog_request_completed:${requestId}`;
}

/** ユーザーが同じ検索条件で、未完了のリクエストを持っているか */
export async function hasOpenCatalogFoodProductRequest(
  userId: string,
  criteria: CatalogSearchCriteria,
  d1?: D1Database,
): Promise<boolean> {
  const [row] = await getDb(d1)
    .select({ id: catalogFoodProductRequests.id })
    .from(catalogFoodProductRequests)
    .where(
      and(
        eq(catalogFoodProductRequests.userId, userId),
        eq(
          catalogFoodProductRequests.searchQuery,
          toCatalogSearchQuery(criteria),
        ),
        isNull(catalogFoodProductRequests.completedAt),
      ),
    )
    .limit(1);
  return row != null;
}

export type CreateCatalogFoodProductRequestResult =
  | "created"
  | "already-requested"
  | "no-criteria"
  | "limit-reached";

/**
 * 検索条件で共通のごはん商品をリクエストする。同じ条件の未完了のリクエストがあれば作らない
 * （一意インデックスで、同時に送られたときも 1 件にする）。
 * 未完了のリクエストの数の上限の判定と追加は 1 つの `INSERT ... SELECT` にし、別の条件の
 * リクエストが同時に送られても上限を超えないようにする
 */
export async function createCatalogFoodProductRequest(
  userId: string,
  criteria: CatalogSearchCriteria,
  d1?: D1Database,
): Promise<CreateCatalogFoodProductRequestResult> {
  if (!hasCatalogSearchCriteria(criteria)) {
    return "no-criteria";
  }
  const db = getDb(d1);
  const openCount = db
    .select({ openCount: count() })
    .from(catalogFoodProductRequests)
    .where(
      and(
        eq(catalogFoodProductRequests.userId, userId),
        isNull(catalogFoodProductRequests.completedAt),
      ),
    );
  // INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値を
  // テーブル定義の順に明示する（`completeCatalogFoodProductRequest` と同じ方式）
  const created = await db
    .insert(catalogFoodProductRequests)
    .select(
      db
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          userId: users.id,
          searchQuery: sql`${toCatalogSearchQuery(criteria)}`.as("searchQuery"),
          label: sql`${formatCatalogSearchCriteria(criteria)}`.as("label"),
          completedAt: sql`null`.as("completedAt"),
          createdAt: sql`(unixepoch())`.as("createdAt"),
        })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            sql`(${openCount}) < ${MAX_OPEN_CATALOG_REQUESTS}`,
          ),
        ),
    )
    .onConflictDoNothing()
    .returning({ id: catalogFoodProductRequests.id });
  if (created.length > 0) {
    return "created";
  }
  // 追加しなかったのは、同じ条件の未完了のリクエストがあったか、上限に達していたとき
  return (await hasOpenCatalogFoodProductRequest(userId, criteria, d1))
    ? "already-requested"
    : "limit-reached";
}

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

export type CompleteCatalogFoodProductRequestResult =
  | "completed"
  | "already-completed"
  | "not-found";

/**
 * リクエストを完了にし、リクエストしたユーザーへの通知を作る。通知の INSERT と完了の UPDATE を
 * 同じ batch で行い、どちらも未完了のときだけ反映する。同時に完了にされても、通知は
 * 重複を防ぐキー（`catalogRequestCompletedDedupeKey`）で 1 件にする。
 * 管理画面（`packages/admin/src/db/catalogFoodProductRequests.ts`）の完了の処理と揃える。
 * Push は次のスケジュール実行（`src/workflows/notification.ts`）で送る
 */
export async function completeCatalogFoodProductRequest(
  requestId: string,
  d1?: D1Database,
): Promise<CompleteCatalogFoodProductRequestResult> {
  const db = getDb(d1);
  const [request] = await db
    .select()
    .from(catalogFoodProductRequests)
    .where(eq(catalogFoodProductRequests.id, requestId))
    .limit(1);
  if (!request) {
    return "not-found";
  }
  if (request.completedAt) {
    return "already-completed";
  }
  const message = catalogRequestCompletedMessage(request);
  // INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値を
  // テーブル定義の順に明示する（`insertSymptomOngoingNotification` と同じ方式）
  const [, completed] = await db.batch([
    db
      .insert(notifications)
      .select(
        db
          .select({
            id: sql`${crypto.randomUUID()}`.as("id"),
            catId: sql`null`.as("catId"),
            householdId: sql`null`.as("householdId"),
            userId: catalogFoodProductRequests.userId,
            kind: sql`'catalog_request_completed'`.as("kind"),
            referenceId: catalogFoodProductRequests.id,
            dedupeKey: sql`${catalogRequestCompletedDedupeKey(requestId)}`.as(
              "dedupeKey",
            ),
            title: sql`${message.title}`.as("title"),
            body: sql`${message.body}`.as("body"),
            url: sql`${message.url}`.as("url"),
            dueAt: sql`(unixepoch())`.as("dueAt"),
            status: sql`'pending'`.as("status"),
            snoozedUntil: sql`null`.as("snoozedUntil"),
            readAt: sql`null`.as("readAt"),
            pushedAt: sql`null`.as("pushedAt"),
            createdAt: sql`(unixepoch())`.as("createdAt"),
            updatedAt: sql`(unixepoch())`.as("updatedAt"),
          })
          .from(catalogFoodProductRequests)
          .where(
            and(
              eq(catalogFoodProductRequests.id, requestId),
              isNull(catalogFoodProductRequests.completedAt),
            ),
          ),
      )
      .onConflictDoNothing({ target: notifications.dedupeKey }),
    db
      .update(catalogFoodProductRequests)
      .set({ completedAt: sql`(unixepoch())` })
      .where(
        and(
          eq(catalogFoodProductRequests.id, requestId),
          isNull(catalogFoodProductRequests.completedAt),
        ),
      )
      .returning({ id: catalogFoodProductRequests.id }),
  ]);
  return completed.length > 0 ? "completed" : "already-completed";
}
