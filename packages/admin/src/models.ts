/**
 * 管理画面の API（`app.ts`）が返すデータの型と、画面（`client/`）とサーバーの両方で使う定数。
 * 画面からも import するため、D1・Drizzle・Workers の型に依存しないこと（`db/` などから
 * import しない）
 */

import type { CatalogFoodProductValues } from "./catalog/form";

export interface Overview {
  userCount: number;
  householdCount: number;
  catCount: number;
  /** 家に所属していない猫の数。0 でなければ `household:link` の実行漏れの可能性がある */
  unassignedCatCount: number;
}

/**
 * ユーザーのアプリ全体の権限（`users.role`）として選べる値。メインアプリのスキーマ
 * （`src/db/schema/users.ts`）の enum と揃える。Drizzle の enum は D1 に CHECK 制約を
 * 作らないため、ここに無い値は書き込む前に断る
 */
export const USER_ROLES = ["admin", "member"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

export interface UserMembership {
  householdId: string;
  householdName: string;
  role: string;
}

export interface AdminUser {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
  /** 有効期限内のログインセッションの数 */
  activeSessionCount: number;
  /** 有効期限内のセッションのうち、最も遅い有効期限 */
  latestSessionExpiresAt: Date | null;
  households: UserMembership[];
}

export interface HouseholdMember {
  userId: string;
  userName: string;
  role: string;
}

export interface AdminHousehold {
  id: string;
  name: string;
  createdAt: Date;
  catCount: number;
  members: HouseholdMember[];
}

export interface CatalogFoodProduct extends CatalogFoodProductValues {
  id: string;
  /** 画像の `media_assets.id`。画像がなければ null */
  imageAssetId: string | null;
  /** この商品から家に追加されたごはん商品の数 */
  addedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

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
