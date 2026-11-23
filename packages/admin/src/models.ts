/**
 * 管理画面の API（`app.ts`）が返すデータの型と、画面（`client/`）とサーバーの両方で使う定数。
 * 画面からも import するため、D1・Drizzle・Workers の型に依存しないこと（`db/` などから
 * import しない）
 */

import type { McpClientApp } from "../../../src/features/mcp/domain/clientApp";
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

/** 家のメンバーとして追加する候補などに使う、ユーザーの名前 */
export interface UserOption {
  id: string;
  name: string;
}

/** ログインセッション。トークン（ハッシュ）は持たず、端末一覧と同じ ID（`sessions.id`）で見分ける */
export interface UserSession {
  id: string;
  /** User-Agent から作った端末名（メインアプリの端末一覧と同じ表記） */
  deviceName: string;
  /** ログインした日時 */
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 通知（Web Push）の購読。送り先の URL・鍵は表示に不要で、外に出すと通知を送れてしまうため持たない
 */
export interface UserPushSubscription {
  id: string;
  deviceName: string;
  createdAt: Date;
  /** 最後に通知を送れた日時。まだ送れていなければ null */
  lastUsedAt: Date | null;
  /** 続けて送れなかった回数（送れると 0 に戻る） */
  failureCount: number;
}

export interface UserHouseholdMembership extends UserMembership {
  /** 家に加わった日時 */
  joinedAt: Date;
}

/** ユーザーの詳細（`/users/:userId`） */
export interface AdminUserDetail {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  households: UserHouseholdMembership[];
  /** 有効期限内のログインセッション（ログインした日時の新しい順） */
  sessions: UserSession[];
  /** 通知の購読（登録した日時の新しい順） */
  pushSubscriptions: UserPushSubscription[];
}

export interface HouseholdMemberDetail extends HouseholdMember {
  /** 家に加わった日時 */
  joinedAt: Date;
}

export interface HouseholdCat {
  id: string;
  name: string;
  sex: string;
  /** 生年月日（YYYY-MM-DD）。年のみ・年月のみのときは、残りを 1 月・1 日で補ったもの */
  birthDate: string | null;
  birthDatePrecision: string;
  /** メモリー（思い出）へ移した日（YYYY-MM-DD）。移していなければ null */
  memorialDate: string | null;
  createdAt: Date;
}

/** 招待の状態。使われた・期限が切れた・まだ使える */
export type HouseholdInvitationStatus = "accepted" | "expired" | "pending";

/** 家への招待。URL のトークン（ハッシュ）は持たない */
export interface HouseholdInvitation {
  id: string;
  createdByUserId: string;
  createdByUserName: string;
  status: HouseholdInvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  /** 招待で家に参加したユーザー。使われていなければ null */
  acceptedByUserId: string | null;
  acceptedByUserName: string | null;
  acceptedAt: Date | null;
}

/** 家の詳細（`/households/:householdId`） */
export interface AdminHouseholdDetail {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  /** メンバー（オーナーを先にし、家に加わった順） */
  members: HouseholdMemberDetail[];
  /** 猫（登録順） */
  cats: HouseholdCat[];
  /** 招待（作った日時の新しい順） */
  invitations: HouseholdInvitation[];
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

/**
 * AI のアプリ（MCP クライアント）のプロバイダーごとの、有効な接続（ユーザーが同意画面で許可した
 * OAuth の grant）の件数。アイコンを見分けられるアプリ（`app`）は接続が無くても並べ、見分けられない
 * プロバイダーは接続先（`redirectHost`）ごとに分ける
 */
export interface McpProvider {
  /**
   * アイコンを見分けられるアプリ（メインアプリの `src/features/mcp/domain/clientApp.ts`）。
   * 見分けられないプロバイダーなら null
   */
  app: McpClientApp | null;
  /**
   * 見分けられないプロバイダーの接続先（認可コードの渡し先の、https ならホスト、それ以外は
   * スキームとホスト）。アプリ（`app`）がある・渡し先が記録されていない接続のまとまりなら null
   */
  redirectHost: string | null;
  /** 有効な接続の数 */
  connectionCount: number;
  /** 接続したアプリが名乗った名前（重複を除いて名前順）。自己申告のため、参考として表示する */
  clientNames: string[];
}
