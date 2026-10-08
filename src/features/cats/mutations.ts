import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
  householdMembers,
  type NewCat,
} from "@/db/schema";
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
 * 判定と更新の間に家から外された場合に更新が通らないよう、所属の確認は UPDATE の WHERE に含める。
 *
 * 支出記録は猫ではなく家に属するため引っ越し元の家に残し、関連する猫・通院記録は支出と同じ家の
 * ものに限るため、引っ越した猫とその通院記録との紐付けを同じ batch で外す。外す対象は UPDATE の後の
 * 猫の家で判定するため、UPDATE が通らなかったときは何も外さない
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
  // 猫の今の家と違う家の支出記録（UPDATE の後に評価するため、引っ越し元の家の支出記録になる）
  const otherHouseholdExpenseIds = db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(
      sql`${expenseRecords.householdId} <> (${db
        .select({ householdId: cats.householdId })
        .from(cats)
        .where(eq(cats.id, catId))})`,
    );
  const [updated] = await db.batch([
    db
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
      .returning({ id: cats.id }),
    db
      .delete(expenseRecordCats)
      .where(
        and(
          eq(expenseRecordCats.catId, catId),
          inArray(expenseRecordCats.expenseRecordId, otherHouseholdExpenseIds),
        ),
      ),
    db
      .delete(expenseRecordHospitalVisits)
      .where(
        and(
          inArray(
            expenseRecordHospitalVisits.hospitalVisitId,
            db
              .select({ id: hospitalVisits.id })
              .from(hospitalVisits)
              .where(eq(hospitalVisits.catId, catId)),
          ),
          inArray(
            expenseRecordHospitalVisits.expenseRecordId,
            otherHouseholdExpenseIds,
          ),
        ),
      ),
  ]);
  return updated.length === 0 ? "not-found" : "updated";
}
