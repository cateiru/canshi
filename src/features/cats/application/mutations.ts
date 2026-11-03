import { getHouseholdForUser } from "@/features/households/infrastructure/queries";
import { deleteMediaAssetsByCat } from "@/features/media/infrastructure/storage";
import type { CatValues } from "../domain/cat";
import { createCatRepository } from "../infrastructure/catRepository";

/*
 * 猫の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の両方から使う
 */

/**
 * 猫を登録する。登録先の家は、ユーザーが所属する家でなければならない。
 * 登録した猫の ID を返し、所属していない家なら null を返す
 */
export async function createCatForUser(
  userId: string,
  values: CatValues,
  d1?: D1Database,
): Promise<string | null> {
  return createCatRepository(d1).addForMember(userId, values);
}

export type UpdateCatResult = "updated" | "household-not-allowed" | "not-found";

/**
 * 猫を更新する。`values.householdId` に今と別の家を渡すと、猫を記録ごとその家へ引っ越す
 * （猫の記録はすべて `cat_id` で猫に紐付くため、`cats.household_id` を変えるだけで移る）。
 * 引っ越し元・引っ越し先のどちらの家にもユーザーが所属している必要がある
 */
export async function updateCatForUser(
  catId: string,
  userId: string,
  values: CatValues,
  d1?: D1Database,
): Promise<UpdateCatResult> {
  // フォームのエラーとして返し分けるため、引っ越し先の家だけは先に確認する
  if (!(await getHouseholdForUser(userId, values.householdId, d1))) {
    return "household-not-allowed";
  }
  const updated = await createCatRepository(d1).updateForMember(
    userId,
    catId,
    values,
  );
  return updated ? "updated" : "not-found";
}

/**
 * 猫を、紐付くメディア（R2 のオブジェクトと media_assets 行）・記録・通知ごと削除する。
 * 支出記録は家計簿として残し、この猫との紐付けだけを外す。
 * ユーザーが猫を参照できることは呼び出し側で確かめる
 */
export async function deleteCatForUser(
  userId: string,
  id: string,
): Promise<void> {
  // media_assets.cat_id が cats.id を参照しているため、猫に紐付くメディア（R2 のオブジェクトと行）を
  // 先に削除する。R2 の削除に失敗した場合はここで例外になり、猫と記録は残る
  await deleteMediaAssetsByCat(id);
  await createCatRepository().removeForUser(userId, id);
}
