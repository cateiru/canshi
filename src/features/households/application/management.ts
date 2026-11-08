import { HOUSEHOLD_HAS_CATS_MESSAGE } from "../domain/labels";
import { createHouseholdRepository } from "../infrastructure/householdRepository";
import { countHouseholdCats } from "../infrastructure/queries";

/*
 * 家の作成・名前の変更・削除・メンバーの管理（ユースケース）。オーナーであることはリポジトリの
 * 文の中で確かめる
 */

export type HouseholdManagementResult =
  | { ok: true }
  | { ok: false; error: string };

/** 家を作成し、作成したユーザーをその家のオーナーにする */
export async function createHousehold(
  userId: string,
  name: string,
  d1?: D1Database,
): Promise<{ householdId: string }> {
  const householdId = await createHouseholdRepository(d1).addWithOwner(
    userId,
    name,
  );
  return { householdId };
}

/** 家の名前を変える。家のオーナーだけが変えられる */
export async function renameHousehold(
  householdId: string,
  ownerUserId: string,
  name: string,
  d1?: D1Database,
): Promise<HouseholdManagementResult> {
  if (
    !(await createHouseholdRepository(d1).renameAsOwner(
      householdId,
      ownerUserId,
      name,
    ))
  ) {
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
  if (
    !(await createHouseholdRepository(d1).removeMemberAsOwner(
      householdId,
      ownerUserId,
      memberUserId,
    ))
  ) {
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
  if (
    !(await createHouseholdRepository(d1).removeSelfAsMember(
      householdId,
      userId,
    ))
  ) {
    return {
      ok: false,
      error:
        "家から抜けられませんでした。オーナーは、先にほかのメンバーへオーナーを移譲してください",
    };
  }
  return { ok: true };
}

/**
 * 家を削除する。家のオーナーだけが、猫のいない家だけを削除できる。家の支出記録・ごはん商品・
 * プリセット・ごはんの時間・招待・メンバーも削除し、メンバー全員がその家の参照と Push 通知の
 * 対象から外れる。猫の記録は猫の削除（`deleteCatForUser`）に任せ、ここでは扱わない
 */
export async function deleteHousehold(
  householdId: string,
  ownerUserId: string,
  d1?: D1Database,
): Promise<HouseholdManagementResult> {
  if (
    await createHouseholdRepository(d1).removeAsOwner(householdId, ownerUserId)
  ) {
    return { ok: true };
  }
  // 削除できなかった理由を伝えるためだけに読み直す（削除の可否はリポジトリの文の中で判定済み）
  if ((await countHouseholdCats(householdId, d1)) > 0) {
    return { ok: false, error: HOUSEHOLD_HAS_CATS_MESSAGE };
  }
  return { ok: false, error: "家を削除できるのはオーナーだけです" };
}
