import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { householdMembers } from "@/db/schema";

export type TransferOwnershipResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 家のオーナーを、同じ家の別のメンバーへ移譲する。移譲先をオーナー（`owner`）にし、
 * 移譲した本人は一般のメンバー（`member`）になる。
 *
 * 現在のオーナー本人（`currentOwnerUserId`）だけが移譲でき、移譲先はオーナーでない
 * 家のメンバーに限る。2 人のロールの入れ替えと条件の判定を 1 つの UPDATE 文にまとめ、
 * 片方だけ書き換わった状態や、同時に移譲されてオーナーがいなくなる状態を作らない
 */
export async function transferHouseholdOwnership(
  householdId: string,
  currentOwnerUserId: string,
  nextOwnerUserId: string,
  d1?: D1Database,
): Promise<TransferOwnershipResult> {
  if (currentOwnerUserId === nextOwnerUserId) {
    return { ok: false, error: "すでにオーナーです" };
  }

  const db = getDb(d1);
  const updated = await db
    .update(householdMembers)
    .set({
      role: sql`CASE WHEN ${householdMembers.userId} = ${nextOwnerUserId} THEN 'owner' ELSE 'member' END`,
    })
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        inArray(householdMembers.userId, [currentOwnerUserId, nextOwnerUserId]),
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

  if (updated.length !== 2) {
    return {
      ok: false,
      error:
        "オーナーを移譲できませんでした。オーナー本人が、同じ家のメンバーを選んでください",
    };
  }
  return { ok: true };
}
