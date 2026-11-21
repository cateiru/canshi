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
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { insertWhere } from "../../../../src/db/conditionalInsert";
import { formatDeviceName } from "../../../../src/features/auth/domain/deviceName";
import {
  type AdminHousehold,
  type AdminHouseholdDetail,
  type AdminUser,
  type AdminUserDetail,
  type HouseholdInvitationStatus,
  type HouseholdMember,
  isUserRole,
  type Overview,
  type UserMembership,
  type UserOption,
} from "../models";
import type { AdminDb } from "./client";
import {
  cats,
  householdInvitations,
  householdMembers,
  households,
  pushSubscriptions,
  sessions,
  users,
} from "./schema";

export type {
  AdminHousehold,
  AdminHouseholdDetail,
  AdminUser,
  AdminUserDetail,
  HouseholdMember,
  Overview,
  UserMembership,
  UserOption,
  UserRole,
} from "../models";
export { isUserRole, USER_ROLES } from "../models";
export type { AdminDb } from "./client";

/** 家のメンバーの並び（オーナーを先にし、家に加わった順） */
const MEMBERSHIP_ORDER = [
  desc(eq(householdMembers.role, "owner")),
  asc(householdMembers.createdAt),
  asc(householdMembers.householdId),
  asc(householdMembers.userId),
];

/** 家のメンバーの一覧（オーナーを先にし、家に加わった順）。`where` で家・ユーザーを絞り込む */
function listMemberships(db: AdminDb, where?: SQL) {
  return db
    .select({
      householdId: householdMembers.householdId,
      householdName: households.name,
      userId: householdMembers.userId,
      userName: users.name,
      role: householdMembers.role,
      joinedAt: householdMembers.createdAt,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(where)
    .orderBy(...MEMBERSHIP_ORDER);
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

/** 全ユーザーの名前（登録順）。家のメンバーとして追加する候補に使う */
export async function listUserOptions(db: AdminDb): Promise<UserOption[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id));
}

/**
 * ユーザー 1 人の詳細。見つからなければ null。セッションのトークン（ハッシュ）と、
 * 通知の購読の送り先・鍵は読み出さない
 */
export async function getUserDetail(
  db: AdminDb,
  userId: string,
  now: Date = new Date(),
): Promise<AdminUserDetail | null> {
  const [[user], memberships, sessionRows, subscriptionRows] =
    await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId)),
      listMemberships(db, eq(householdMembers.userId, userId)),
      db
        .select({
          id: sessions.id,
          userAgent: sessions.userAgent,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
        .orderBy(desc(sessions.createdAt), asc(sessions.id)),
      db
        .select({
          id: pushSubscriptions.id,
          userAgent: pushSubscriptions.userAgent,
          createdAt: pushSubscriptions.createdAt,
          lastUsedAt: pushSubscriptions.lastUsedAt,
          failureCount: pushSubscriptions.failureCount,
        })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId))
        .orderBy(desc(pushSubscriptions.createdAt), asc(pushSubscriptions.id)),
    ]);
  if (!user) {
    return null;
  }
  return {
    ...user,
    households: memberships.map((row) => ({
      householdId: row.householdId,
      householdName: row.householdName,
      role: row.role,
      joinedAt: row.joinedAt,
    })),
    sessions: sessionRows.map(({ userAgent, ...row }) => ({
      ...row,
      deviceName: formatDeviceName(userAgent),
    })),
    pushSubscriptions: subscriptionRows.map(({ userAgent, ...row }) => ({
      ...row,
      deviceName: formatDeviceName(userAgent),
    })),
  };
}

/** 招待の状態。メインアプリと同じく、期限ちょうどの招待はもう使えない */
function invitationStatus(
  invitation: { acceptedByUserId: string | null; expiresAt: Date },
  now: Date,
): HouseholdInvitationStatus {
  if (invitation.acceptedByUserId !== null) {
    return "accepted";
  }
  return invitation.expiresAt <= now ? "expired" : "pending";
}

/** 家 1 件の詳細。見つからなければ null。招待の URL のトークン（ハッシュ）は読み出さない */
export async function getHouseholdDetail(
  db: AdminDb,
  householdId: string,
  now: Date = new Date(),
): Promise<AdminHouseholdDetail | null> {
  const creators = alias(users, "creators");
  const acceptors = alias(users, "acceptors");
  const [[household], memberships, catRows, invitationRows] = await Promise.all(
    [
      db
        .select({
          id: households.id,
          name: households.name,
          createdAt: households.createdAt,
          updatedAt: households.updatedAt,
        })
        .from(households)
        .where(eq(households.id, householdId)),
      listMemberships(db, eq(householdMembers.householdId, householdId)),
      db
        .select({
          id: cats.id,
          name: cats.name,
          sex: cats.sex,
          birthDate: cats.birthDate,
          birthDatePrecision: cats.birthDatePrecision,
          memorialDate: cats.memorialDate,
          createdAt: cats.createdAt,
        })
        .from(cats)
        .where(eq(cats.householdId, householdId))
        .orderBy(asc(cats.createdAt), asc(cats.id)),
      db
        .select({
          id: householdInvitations.id,
          createdByUserId: householdInvitations.createdByUserId,
          createdByUserName: creators.name,
          createdAt: householdInvitations.createdAt,
          expiresAt: householdInvitations.expiresAt,
          acceptedByUserId: householdInvitations.acceptedByUserId,
          acceptedByUserName: acceptors.name,
          acceptedAt: householdInvitations.acceptedAt,
        })
        .from(householdInvitations)
        .innerJoin(
          creators,
          eq(creators.id, householdInvitations.createdByUserId),
        )
        .leftJoin(
          acceptors,
          eq(acceptors.id, householdInvitations.acceptedByUserId),
        )
        .where(eq(householdInvitations.householdId, householdId))
        .orderBy(
          desc(householdInvitations.createdAt),
          asc(householdInvitations.id),
        ),
    ],
  );
  if (!household) {
    return null;
  }
  return {
    ...household,
    members: memberships.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      role: row.role,
      joinedAt: row.joinedAt,
    })),
    cats: catRows,
    invitations: invitationRows.map((row) => ({
      ...row,
      status: invitationStatus(row, now),
    })),
  };
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
