import type { CatalogFoodProductRequest } from "./catalogRequest";

/** リクエストを完了にしたときに、リクエストしたユーザーへ送る通知 */
export type CatalogRequestCompletedNotification = {
  title: string;
  body: string;
  url: string;
  /** 通知の重複を防ぐキー */
  dedupeKey: string;
};

/**
 * 共通のごはん商品のリクエストの保存先。実装は `../infrastructure/catalogRequestRepository.ts`
 */
export interface CatalogRequestRepository {
  /** ユーザーが同じ検索条件（`searchQuery`）で、未完了のリクエストを持っているか */
  existsOpen(userId: string, searchQuery: string): Promise<boolean>;
  /**
   * リクエストを追加する。同じ条件の未完了のリクエストがある、またはユーザーの未完了の
   * リクエストが `maxOpen` 件に達していれば追加せずに false。上限の判定と追加は 1 つの文で行う
   */
  addWithinLimit(
    userId: string,
    searchQuery: string,
    label: string,
    maxOpen: number,
  ): Promise<boolean>;
  /** リクエストを読む。見つからなければ null */
  findById(id: string): Promise<CatalogFoodProductRequest | null>;
  /**
   * リクエストを完了にし、リクエストしたユーザーへの通知を作る。同じ batch で行い、
   * どちらも未完了のときだけ反映する。完了にできなければ（すでに完了なら）false
   */
  complete(
    id: string,
    notification: CatalogRequestCompletedNotification,
  ): Promise<boolean>;
}
