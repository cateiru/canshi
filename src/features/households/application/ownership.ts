import { createHouseholdRepository } from "../infrastructure/householdRepository";

export type TransferOwnershipResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 家のオーナーを、同じ家の別のメンバーへ移譲する（ユースケース）。移譲先をオーナー（`owner`）にし、
 * 移譲した本人は一般のメンバー（`member`）になる。
 *
 * 現在のオーナー本人（`currentOwnerUserId`）だけが移譲でき、移譲先はオーナーでない
 * 家のメンバーに限る。片方だけ書き換わった状態や、同時に移譲されてオーナーがいなくなる状態は
 * リポジトリの 1 つの文で防ぐ
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

  if (
    !(await createHouseholdRepository(d1).transferOwnership(
      householdId,
      currentOwnerUserId,
      nextOwnerUserId,
    ))
  ) {
    return {
      ok: false,
      error:
        "オーナーを移譲できませんでした。オーナー本人が、同じ家のメンバーを選んでください",
    };
  }
  return { ok: true };
}
