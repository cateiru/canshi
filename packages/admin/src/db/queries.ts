/**
 * 管理画面が表示するデータを D1 から読み出すクエリ。
 *
 * メインアプリの Drizzle スキーマ（`./schema`）を使い、SQL を文字列で組み立てない
 * （値はすべてバインドパラメーターで渡す）。`queries.test.ts` はリポジトリルートの `drizzle/` の
 * マイグレーションを適用した DB で実行するため、スキーマとマイグレーションの食い違いもテストで検出できる。
 *
 * 管理画面は基本的に閲覧用で、書き込みはユーザーの権限の変更と、ユーザーのセッションの削除
 * （すべての端末からログアウトさせる）、家へのメンバーの追加・削除、共通のごはん商品の
 * 登録・編集・削除（`catalogFoodProducts.ts`）、共通のごはん商品のリクエストの完了と、
 * そのときの通知の作成（`catalogFoodProductRequests.ts`）だけにする。
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  isNull,
  max,
  notExists,
  sql,
} from "drizzle-orm";
import { insertWhere } from "../../../../src/db/conditionalInsert";
import type { AdminDb } from "./client";
import { cats, householdMembers, households, sessions, users } from "./schema";

export type { AdminDb } from "./client";

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

/** 家のメンバーの一覧（オーナーを先にし、家に加わった順） */
function listMemberships(db: AdminDb) {
  return db
    .select({
      householdId: householdMembers.householdId,
      householdName: households.name,
      userId: householdMembers.userId,
      userName: users.name,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .orderBy(
      desc(eq(householdMembers.role, "owner")),
      asc(householdMembers.createdAt),
      asc(householdMembers.userId),
    );
}

export async function getOverview(db: AdminDb): Promise<Overview> {
  const [[user], [household], [cat], [unassignedCat]] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(households),
    db.select({ count: count() }).from(cats),
    db.select({ count: count() }).from(cats).where(isNull(cats.householdId)),
  ]);
  return {
    userCount: user.count,
    householdCount: household.count,
    catCount: cat.count,
    unassignedCatCount: unassignedCat.count,
  };
}

/**
 * ユーザーの一覧（登録順）。セッションのトークン（ハッシュ）は表示に不要なため読み出さず、
 * 有効なセッションの数と有効期限だけを集計する
 */
export async function listUsers(
  db: AdminDb,
  now: Date = new Date(),
): Promise<AdminUser[]> {
  const [userRows, memberships] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        activeSessionCount: count(sessions.userId),
        latestSessionExpiresAt: max(sessions.expiresAt),
      })
      .from(users)
      .leftJoin(
        sessions,
        and(eq(sessions.userId, users.id), gt(sessions.expiresAt, now)),
      )
      .groupBy(users.id)
      .orderBy(asc(users.createdAt), asc(users.id)),
    listMemberships(db),
  ]);

  const householdsByUser = new Map<string, UserMembership[]>();
  for (const row of memberships) {
    const list = householdsByUser.get(row.userId) ?? [];
    list.push({
      householdId: row.householdId,
      householdName: row.householdName,
      role: row.role,
    });
    householdsByUser.set(row.userId, list);
  }

  return userRows.map((row) => ({
    ...row,
    households: householdsByUser.get(row.id) ?? [],
  }));
}

/** 家の一覧（作成順）。メンバーはオーナーを先にする */
export async function listHouseholds(db: AdminDb): Promise<AdminHousehold[]> {
  const [householdRows, memberships] = await Promise.all([
    db
      .select({
        id: households.id,
        name: households.name,
        createdAt: households.createdAt,
        catCount: count(cats.id),
      })
      .from(households)
      .leftJoin(cats, eq(cats.householdId, households.id))
      .groupBy(households.id)
      .orderBy(asc(households.createdAt), asc(households.id)),
    listMemberships(db),
  ]);

  const membersByHousehold = new Map<string, HouseholdMember[]>();
  for (const row of memberships) {
    const list = membersByHousehold.get(row.householdId) ?? [];
    list.push({ userId: row.userId, userName: row.userName, role: row.role });
    membersByHousehold.set(row.householdId, list);
  }

  return householdRows.map((row) => ({
    ...row,
    members: membersByHousehold.get(row.id) ?? [],
  }));
}

/**
 * ユーザーのログインセッションをすべて削除し（すべての端末からログアウトさせる）、
 * 削除した数を返す。メインアプリはリクエストのたびに D1 のセッションと照合するため、
 * 削除した時点でそのユーザーのどの端末の Cookie も使えなくなる
 */
export async function deleteUserSessions(
  db: AdminDb,
  userId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ tokenHash: sessions.tokenHash });
  return deleted.length;
}

export type UserRoleChangeResult = { ok: true } | { ok: false; error: string };

/**
 * ユーザーのアプリ全体の権限（`users.role`）を変える。家の中での権限
 * （`household_members.role`）とは別で、管理者（`admin`）にしても管理画面に入れるように
 * なるわけではない（管理画面へのアクセスは Cloudflare Access のポリシーで決まる）
 */
export async function updateUserRole(
  db: AdminDb,
  userId: string,
  role: string,
): Promise<UserRoleChangeResult> {
  if (!isUserRole(role)) {
    return { ok: false, error: `権限 ${role} は選べません` };
  }
  const updated = await db
    .update(users)
    .set({ role, updatedAt: sql`(unixepoch())` })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (updated.length === 0) {
    return { ok: false, error: "権限を変えるユーザーが見つかりませんでした" };
  }
  return { ok: true };
}

export type HouseholdMemberChangeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * ユーザーを家のメンバー（`member`）として追加する。家・ユーザーが存在し、まだその家の
 * メンバーでないときだけ追加する（判定と追加を 1 文にまとめ、同時に操作されても重複させない）。
 * オーナーにしたいときは、メインアプリの設定からオーナーを移譲する
 */
export async function addHouseholdMember(
  db: AdminDb,
  householdId: string,
  userId: string,
): Promise<HouseholdMemberChangeResult> {
  const inserted = await insertWhere(
    db,
    householdMembers,
    { householdId, userId, role: "member" },
    and(
      exists(
        db
          .select({ id: households.id })
          .from(households)
          .where(eq(households.id, householdId)),
      ),
      exists(
        db.select({ id: users.id }).from(users).where(eq(users.id, userId)),
      ),
      notExists(
        db
          .select({ userId: householdMembers.userId })
          .from(householdMembers)
          .where(
            and(
              eq(householdMembers.householdId, householdId),
              eq(householdMembers.userId, userId),
            ),
          ),
      ),
    ),
  ).returning({ userId: householdMembers.userId });
  if (inserted.length === 0) {
    return {
      ok: false,
      error:
        "メンバーを追加できませんでした。家・ユーザーが存在し、まだその家のメンバーでないことを確かめてください",
    };
  }
  return { ok: true };
}

/**
 * ユーザーを家から外す。家にオーナーがいなくならないよう、オーナー（`role` が `owner`）は
 * 外せない（メインアプリの `removeHouseholdMember` と同じ制約）。外したユーザーは、その家の
 * 猫の参照と Push 通知の対象からすぐに外れる（どちらも `household_members` から都度引くため）
 */
export async function removeHouseholdMember(
  db: AdminDb,
  householdId: string,
  userId: string,
): Promise<HouseholdMemberChangeResult> {
  const deleted = await db
    .delete(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        eq(householdMembers.role, "member"),
      ),
    )
    .returning({ userId: householdMembers.userId });
  if (deleted.length === 0) {
    return {
      ok: false,
      error:
        "メンバーを外せませんでした。オーナーは外せないため、先にメインアプリでオーナーを移譲してください",
    };
  }
  return { ok: true };
}
