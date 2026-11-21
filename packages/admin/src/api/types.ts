/**
 * 管理画面の API（`/api/*`、`app.ts`）の JSON の型。画面（`client/`）とサーバーの両方で使うため、
 * D1・Drizzle・Workers の型に依存しないこと
 */

import type {
  CatalogFoodProductErrors,
  CatalogFoodProductInput,
} from "../catalog/form";
import type {
  AdminHousehold,
  AdminHouseholdDetail,
  AdminUser,
  AdminUserDetail,
  CatalogFoodProduct,
  CatalogFoodProductRequest,
  Overview,
  UserOption,
} from "../models";

/** JSON にした値の型。日時（`Date`）は ISO 8601 の文字列になる */
export type Json<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

export type OverviewResponse = Json<Overview>;

export type UserJson = Json<AdminUser>;

export interface UsersResponse {
  users: UserJson[];
}

export type HouseholdJson = Json<AdminHousehold>;

export interface HouseholdsResponse {
  households: HouseholdJson[];
  /** メンバーとして追加する候補（全ユーザー） */
  users: UserJson[];
}

export type UserOptionJson = Json<UserOption>;

export type UserDetailJson = Json<AdminUserDetail>;

export interface UserDetailResponse {
  user: UserDetailJson;
}

export type HouseholdDetailJson = Json<AdminHouseholdDetail>;

export interface HouseholdDetailResponse {
  household: HouseholdDetailJson;
  /** 全ユーザー（メンバーとして追加する候補と、追加・削除の結果の表示に使う） */
  users: UserOptionJson[];
}

export type CatalogFoodProductJson = Json<CatalogFoodProduct>;

export interface CatalogFoodProductsResponse {
  products: CatalogFoodProductJson[];
}

export interface CatalogFoodProductResponse {
  product: CatalogFoodProductJson;
}

/** 共通のごはん商品の登録・更新が終わったときの応答 */
export interface CatalogFoodProductSavedResponse {
  id: string;
}

/**
 * 共通のごはん商品の登録・更新で、入力に誤りがある・保存容量が足りないときの応答
 * （400・507）。`input` は送られた入力を読み直したもの（入力欄の値は画面が持っているため参考）
 */
export interface CatalogFoodProductInvalidResponse {
  errors: CatalogFoodProductErrors;
  input?: CatalogFoodProductInput;
}

export type CatalogFoodProductRequestJson = Json<CatalogFoodProductRequest>;

export interface CatalogFoodProductRequestsResponse {
  open: CatalogFoodProductRequestJson[];
  completed: CatalogFoodProductRequestJson[];
}

/** 権限の変更・メンバーの追加と削除の結果。失敗したときは 400 で返す */
export type ChangeResponse = { ok: true } | { ok: false; error: string };

/** リクエストを完了にした結果 */
export interface CompleteRequestResponse {
  result: "completed" | "already-completed";
}

/** エラーの応答（404 など） */
export interface ErrorResponse {
  error: string;
}
