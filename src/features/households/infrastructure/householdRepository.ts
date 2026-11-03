import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { householdMembers, households } from "@/db/schema";
import type { HouseholdRepository } from "../domain/householdRepository";

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

/** D1 に保存する `HouseholdRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createHouseholdRepository(
  d1?: D1Database,
): HouseholdRepository {
  const db = getDb(d1);
  return {
    async addWithOwner(ownerUserId, name) {
      // 家だけが作られてオーナーのいない家が残らないよう、家とメンバーの追加は
      // 1 つの batch（トランザクション）で行う
      const householdId = crypto.randomUUID();
      await db.batch([
        db.insert(households).values({ id: householdId, name }),
        db
          .insert(householdMembers)
          .values({ householdId, userId: ownerUserId, role: "owner" }),
      ]);
      return householdId;
    },

    async renameAsOwner(householdId, ownerUserId, name) {
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
      return updated.length > 0;
    },

    async removeMemberAsOwner(householdId, ownerUserId, memberUserId) {
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
      return deleted.length > 0;
    },

    async removeSelfAsMember(householdId, userId) {
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
      return deleted.length > 0;
    },

    async transferOwnership(householdId, currentOwnerUserId, nextOwnerUserId) {
      const updated = await db
        .update(householdMembers)
        .set({
          role: sql`CASE WHEN ${householdMembers.userId} = ${nextOwnerUserId} THEN 'owner' ELSE 'member' END`,
        })
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            inArray(householdMembers.userId, [
              currentOwnerUserId,
              nextOwnerUserId,
            ]),
            // 移譲元がオーナーで、移譲先がオーナーでないメンバーのときだけ書き換える
            sql`(
              SELECT COUNT(*) FROM ${householdMembers} AS m
              WHERE m.household_id = ${householdId}
                AND (
                  (m.user_id = ${currentOwnerUserId} AND m.role = 'owner')
                  OR (m.user_id = ${nextOwnerUserId} AND m.role = 'member')
                )
            ) = 2`,
          ),
        )
        .returning({ userId: householdMembers.userId });
      return updated.length === 2;
    },
  };
}
