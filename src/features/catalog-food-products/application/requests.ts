import {
  catalogRequestCompletedDedupeKey,
  catalogRequestCompletedMessage,
  formatCatalogSearchCriteria,
  hasCatalogSearchCriteria,
  MAX_OPEN_CATALOG_REQUESTS,
  toCatalogSearchQuery,
} from "../domain/catalogRequest";
import type { CatalogSearchCriteria } from "../domain/search";
import { createCatalogRequestRepository } from "../infrastructure/catalogRequestRepository";

/*
 * 共通のごはん商品のリクエスト（ユースケース）。リクエストは画面から、完了は AI との接続（MCP）と
 * 管理画面（`packages/admin/src/db/catalogFoodProductRequests.ts`）から行う
 */

/** ユーザーが同じ検索条件で、未完了のリクエストを持っているか */
export async function hasOpenCatalogFoodProductRequest(
  userId: string,
  criteria: CatalogSearchCriteria,
  d1?: D1Database,
): Promise<boolean> {
  return createCatalogRequestRepository(d1).existsOpen(
    userId,
    toCatalogSearchQuery(criteria),
  );
}

export type CreateCatalogFoodProductRequestResult =
  | "created"
  | "already-requested"
  | "no-criteria"
  | "limit-reached";

/**
 * 検索条件で共通のごはん商品をリクエストする。同じ条件の未完了のリクエストがあれば作らない。
 * 未完了のリクエストの数の上限（`MAX_OPEN_CATALOG_REQUESTS`）は、別の条件のリクエストが
 * 同時に送られても超えないよう、リポジトリの 1 つの文で判定する
 */
export async function createCatalogFoodProductRequest(
  userId: string,
  criteria: CatalogSearchCriteria,
  d1?: D1Database,
): Promise<CreateCatalogFoodProductRequestResult> {
  if (!hasCatalogSearchCriteria(criteria)) {
    return "no-criteria";
  }
  const repository = createCatalogRequestRepository(d1);
  const searchQuery = toCatalogSearchQuery(criteria);
  if (
    await repository.addWithinLimit(
      userId,
      searchQuery,
      formatCatalogSearchCriteria(criteria),
      MAX_OPEN_CATALOG_REQUESTS,
    )
  ) {
    return "created";
  }
  // 追加しなかったのは、同じ条件の未完了のリクエストがあったか、上限に達していたとき
  return (await repository.existsOpen(userId, searchQuery))
    ? "already-requested"
    : "limit-reached";
}

export type CompleteCatalogFoodProductRequestResult =
  | "completed"
  | "already-completed"
  | "not-found";

/**
 * リクエストを完了にし、リクエストしたユーザーへの通知を作る。
 * 管理画面（`packages/admin/src/db/catalogFoodProductRequests.ts`）の完了の処理と揃える。
 * Push は次のスケジュール実行（`src/workflows/notification.ts`）で送る
 */
export async function completeCatalogFoodProductRequest(
  requestId: string,
  d1?: D1Database,
): Promise<CompleteCatalogFoodProductRequestResult> {
  const repository = createCatalogRequestRepository(d1);
  const request = await repository.findById(requestId);
  if (!request) {
    return "not-found";
  }
  if (request.completedAt) {
    return "already-completed";
  }
  const completed = await repository.complete(requestId, {
    ...catalogRequestCompletedMessage(request),
    dedupeKey: catalogRequestCompletedDedupeKey(requestId),
  });
  return completed ? "completed" : "already-completed";
}
