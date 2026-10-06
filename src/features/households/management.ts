import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { householdMembers, households } from "@/db/schema";

export type HouseholdManagementResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * `userId` がその家のオーナーであるときだけ真になる条件。読んでから書く方式だと、
 * 判定と更新の間にオーナーを移譲された場合に元オーナーの操作が通ってしまうため、
 * 更新・削除の WHERE に含めて 1 文で判定する
 */
export function isOwnerCondition(householdId: string, userId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${householdMembers} AS owner
    WHERE owner.household_id = ${householdId}
      AND owner.user_id = ${userId}
      AND owner.role = 'owner'
  )`;
}

/** 家の名前を変える。家のオーナーだけが変えられる */
export async function renameHousehold(
  householdId: string,
  ownerUserId: string,
  name: string,
  d1?: D1Database,
): Promise<HouseholdManagementResult> {
  const db = getDb(d1);
  const updated = await db
    .update(households)
    .set({ name, updatedAt: new Date() })
    .where(
      and(
        eq(households.id, householdId),
        isOwnerCondition(householdId, ownerUserId),
      ),
    )
    .returning({ id: households.id });

  if (updated.length === 0) {
    return { ok: false, error: "家の名前を変えられるのはオーナーだけです" };
  }
  return { ok: true };
}

/**
 * 家のメンバーを家から外す。家のオーナーだけが外せ、オーナー自身（`role` が `owner` の
 * メンバー）は外せない。外したメンバーは、その家の猫の参照と Push 通知の対象から
 * すぐに外れる（どちらも `household_members` から都度引くため）
 */
export async function removeHouseholdMember(
  householdId: string,
  ownerUserId: string,
  memberUserId: string,
  d1?: D1Database,
): Promise<HouseholdManagementResult> {
  const db = getDb(d1);
  const deleted = await db
    .delete(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, memberUserId),
        eq(householdMembers.role, "member"),
        isOwnerCondition(householdId, ownerUserId),
      ),
    )
    .returning({ userId: householdMembers.userId });

  if (deleted.length === 0) {
    return {
      ok: false,
      error:
        "メンバーを外せませんでした。オーナー本人が、オーナー以外のメンバーを選んでください",
    };
  }
  return { ok: true };
}

/**
 * ユーザー自身が家から抜ける。家にオーナーがいなくならないよう、オーナーは抜けられない
 * （先に別のメンバーへオーナーを移譲する）
 */
export async function leaveHousehold(
  householdId: string,
  userId: string,
  d1?: D1Database,
): Promise<HouseholdManagementResult> {
  const db = getDb(d1);
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
        "家から抜けられませんでした。オーナーは、先にほかのメンバーへオーナーを移譲してください",
    };
  }
  return { ok: true };
}
