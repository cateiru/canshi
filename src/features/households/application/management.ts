import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/domain/media";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/domain/media";
import { deleteMediaAssetsByRecords } from "@/features/media/infrastructure/storage";
import type { RemovedHousehold } from "../domain/householdRepository";
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
 * 対象から外れる。猫の記録は猫の削除（`deleteCatForUser`）に任せ、ここでは扱わない。
 *
 * ごはん商品・支出記録の画像（R2 と `media_assets`）は、家の削除が成功してから消す。R2 の削除は
 * D1 の batch に含められないため、先に消すと、家の削除が条件を満たさずに失敗したときに画像だけが
 * 消えてしまう。R2 を扱うため、`deleteCatForUser` と同じく D1 は受け取らない
 */
export async function deleteHousehold(
  householdId: string,
  ownerUserId: string,
): Promise<HouseholdManagementResult> {
  const removed = await createHouseholdRepository().removeAsOwner(
    householdId,
    ownerUserId,
  );
  if (removed) {
    await deleteRemovedHouseholdMedia(householdId, removed);
    return { ok: true };
  }
  // 削除できなかった理由を伝えるためだけに読み直す（削除の可否はリポジトリの文の中で判定済み）
  if ((await countHouseholdCats(householdId)) > 0) {
    return { ok: false, error: HOUSEHOLD_HAS_CATS_MESSAGE };
  }
  return { ok: false, error: "家を削除できるのはオーナーだけです" };
}

/**
 * 削除した家のごはん商品・支出記録に付いていた画像を消す。家はもう消えていてやり直せないため、
 * 失敗しても家の削除は成功として扱い、ログだけ残す（R2 に参照されない画像が残る）
 */
async function deleteRemovedHouseholdMedia(
  householdId: string,
  removed: RemovedHousehold,
): Promise<void> {
  try {
    await deleteMediaAssetsByRecords(
      FOOD_PRODUCT_MEDIA_TYPE,
      removed.foodProductIds,
    );
    await deleteMediaAssetsByRecords(
      EXPENSE_MEDIA_TYPE,
      removed.expenseRecordIds,
    );
  } catch (error) {
    console.error(
      `Failed to delete media of the deleted household ${householdId}`,
      error,
    );
  }
}
