import type { CatalogFoodProductRequest } from "@/db/schema";
import {
  LIFE_STAGE_LABEL,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/domain/labels";
import { type CatalogSearchCriteria, hasAdvancedCriteria } from "./search";

/**
 * 共通のごはん商品のリクエスト（エンティティ）。ユーザーが検索で見つからなかった条件を送り、
 * admin のユーザーが商品を登録して完了にする。完了にするとリクエストしたユーザーへ通知する
 */
export type { CatalogFoodProductRequest };

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
    parts.push(`対象のねこ：${LIFE_STAGE_LABEL[criteria.lifeStage]}`);
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
