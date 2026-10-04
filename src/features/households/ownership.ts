import { and, eq, exists } from "drizzle-orm";
import { getDb } from "@/db/client";
import { householdMembers, households } from "@/db/schema";

export type TransferOwnershipResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 家のオーナーを、同じ家の別のメンバーへ移譲する。オーナーは常に 1 名のため、
 * `households.owner_user_id` を書き換えるだけで元のオーナーは一般のメンバーになる。
 *
 * 現在のオーナー本人（`currentOwnerUserId`）だけが移譲でき、移譲先は家のメンバーに
 * 限る。判定と更新を 1 つの UPDATE 文の条件にまとめ、同時に移譲されても
 * オーナーが 2 名にならないようにする
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
    .update(households)
    .set({ ownerUserId: nextOwnerUserId, updatedAt: new Date() })
    .where(
      and(
        eq(households.id, householdId),
        eq(households.ownerUserId, currentOwnerUserId),
        exists(
          db
            .select({ userId: householdMembers.userId })
            .from(householdMembers)
            .where(
              and(
                eq(householdMembers.householdId, householdId),
                eq(householdMembers.userId, nextOwnerUserId),
              ),
            ),
        ),
      ),
    )
    .returning({ id: households.id });

  if (updated.length === 0) {
    return {
      ok: false,
      error:
        "オーナーを移譲できませんでした。オーナー本人が、同じ家のメンバーを選んでください",
    };
  }
  return { ok: true };
}
