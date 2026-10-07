import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats, householdMembers, type NewCat } from "@/db/schema";
import { getHouseholdForUser } from "@/features/households/queries";

/** フォームから保存する猫の項目。`householdId` は猫を飼っている家（登録先・引っ越し先） */
export type CatValues = Pick<
  NewCat,
  "name" | "sex" | "birthDate" | "birthDatePrecision" | "breed" | "adoptedAt"
> & { householdId: string };

/** 選んだ家にユーザーが所属していないときのエラー（改ざんされた値や、抜けた家が送られた場合） */
export const HOUSEHOLD_NOT_ALLOWED_ERROR = "所属している家を選択してください";

/**
 * 猫を登録する。登録先の家は、ユーザーが所属する家でなければならない。
 * 登録した猫の ID を返し、所属していない家なら null を返す。
 * 判定と登録の間に家から外された場合に登録が通らないよう、INSERT ... SELECT で
 * 登録先の家のメンバーの行があるときだけ 1 文で挿入する
 */
export async function createCatForUser(
  userId: string,
  values: CatValues,
  d1?: D1Database,
) {
  const db = getDb(d1);
  // INSERT ... SELECT では列の既定値（`$defaultFn`）が使われないため、ID はここで作る。
  // 選ぶ列はテーブル定義と同じ並びにする（違うと drizzle が実行時にエラーにする）
  const [created] = await db
    .insert(cats)
    .select((qb) =>
      qb
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          householdId: householdMembers.householdId,
          name: sql`${values.name}`.as("name"),
          sex: sql`${values.sex}`.as("sex"),
          birthDate: sql`${values.birthDate ?? null}`.as("birth_date"),
          birthDatePrecision: sql`${values.birthDatePrecision ?? "day"}`.as(
            "birth_date_precision",
          ),
          breed: sql`${values.breed ?? null}`.as("breed"),
          adoptedAt: sql`${values.adoptedAt ?? null}`.as("adopted_at"),
          profileMediaAssetId: sql`NULL`.as("profile_media_asset_id"),
          createdAt: sql`(unixepoch())`.as("created_at"),
          updatedAt: sql`(unixepoch())`.as("updated_at"),
        })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, values.householdId),
            eq(householdMembers.userId, userId),
          ),
        ),
    )
    .returning({ id: cats.id });
  return created?.id ?? null;
}

export type UpdateCatResult = "updated" | "household-not-allowed" | "not-found";

/**
 * 猫を更新する。`values.householdId` に今と別の家を渡すと、猫を記録ごとその家へ引っ越す
 * （猫の記録はすべて `cat_id` で猫に紐付くため、`cats.household_id` を変えるだけで移る）。
 * 引っ越し元・引っ越し先のどちらの家にもユーザーが所属している必要がある。
 * 判定と更新の間に家から外された場合に更新が通らないよう、所属の確認は UPDATE の WHERE に含める
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
  const db = getDb(d1);
  const updated = await db
    .update(cats)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(cats.id, catId),
        sql`EXISTS (
          SELECT 1 FROM ${householdMembers} AS current_member
          WHERE current_member.household_id = ${cats.householdId}
            AND current_member.user_id = ${userId}
        )`,
        sql`EXISTS (
          SELECT 1 FROM ${householdMembers} AS next_member
          WHERE next_member.household_id = ${values.householdId}
            AND next_member.user_id = ${userId}
        )`,
      ),
    )
    .returning({ id: cats.id });
  return updated.length === 0 ? "not-found" : "updated";
}
