import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  brushingRecords,
  cats,
  cleaningRecords,
  cleaningTargets,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  feedingRecords,
  hospitalVisits,
  householdMembers,
  medicationDoses,
  medications,
  memoRecords,
  type NewCat,
  notificationSettings,
  notifications,
  poopRecords,
  shampooRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import { dismissFeedingNotificationsOfCatlessHouseholds } from "@/features/feeding-schedules/application/mutations";
import { getHouseholdForUser } from "@/features/households/infrastructure/queries";
import { deleteMediaAssetsByCat } from "@/features/media/infrastructure/storage";

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
    // 最後の猫が引っ越して猫のいなくなった家に、ごはんの時間の通知を残さない
    dismissFeedingNotificationsOfCatlessHouseholds(db, userId),
  ]);
  return updated.length === 0 ? "not-found" : "updated";
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
  const db = getDb();
  // media_assets.cat_id が cats.id を参照しているため、猫に紐付くメディア（R2 のオブジェクトと行）を
  // 先に削除する。R2 の削除に失敗した場合はここで例外になり、猫と記録は残る
  await deleteMediaAssetsByCat(id);
  // 各記録テーブルは cats.id への外部キー制約（ON DELETE no action）を持つため、
  // 猫本体より先に紐づく記録を削除しておく。symptoms と hospital_visits は
  // 互いを参照しうるため、削除前にまず双方の紐付け（hospital_visit_id /
  // symptom_id）を解除して循環を断ち切る。medications.symptom_id が
  // symptoms を参照しているため、medications（と、それに依存する
  // medicationDoses）は symptoms より先に削除する。途中で失敗して猫だけ残る
  // /一部の記録だけ消えるような中途半端な状態にならないよう、1つの
  // db.batch でまとめて原子的に実行する
  await db.batch([
    db.delete(feedingRecords).where(eq(feedingRecords.catId, id)),
    db.delete(poopRecords).where(eq(poopRecords.catId, id)),
    db.delete(weightRecords).where(eq(weightRecords.catId, id)),
    db.delete(vomitRecords).where(eq(vomitRecords.catId, id)),
    db.delete(waterRecords).where(eq(waterRecords.catId, id)),
    db.delete(shampooRecords).where(eq(shampooRecords.catId, id)),
    db.delete(brushingRecords).where(eq(brushingRecords.catId, id)),
    db.delete(memoRecords).where(eq(memoRecords.catId, id)),
    // cleaning_records は cats・cleaning_targets の双方を参照するため、
    // cleaning_targets より先に削除する
    db.delete(cleaningRecords).where(eq(cleaningRecords.catId, id)),
    db.delete(cleaningTargets).where(eq(cleaningTargets.catId, id)),
    // 支出記録そのものはすべての猫で共通のため削除せず、この猫との紐付けだけを外す。
    // 結果として関連する猫が 0 件になった支出は「どの猫にも紐付かない共通の支出」として残る
    db.delete(expenseRecordCats).where(eq(expenseRecordCats.catId, id)),
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(eq(symptoms.catId, id)),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(eq(medications.catId, id)),
    db
      .update(hospitalVisits)
      .set({ symptomId: null })
      .where(eq(hospitalVisits.catId, id)),
    // expense_record_hospital_visits も hospital_visits を参照しているため、
    // 通院記録を削除する前に紐付けを外す。支出記録そのものは家計簿として残す
    db
      .delete(expenseRecordHospitalVisits)
      .where(
        inArray(
          expenseRecordHospitalVisits.hospitalVisitId,
          db
            .select({ id: hospitalVisits.id })
            .from(hospitalVisits)
            .where(eq(hospitalVisits.catId, id)),
        ),
      ),
    db.delete(hospitalVisits).where(eq(hospitalVisits.catId, id)),
    db.delete(medicationDoses).where(eq(medicationDoses.catId, id)),
    db.delete(medications).where(eq(medications.catId, id)),
    db.delete(symptoms).where(eq(symptoms.catId, id)),
    db.delete(notifications).where(eq(notifications.catId, id)),
    db.delete(notificationSettings).where(eq(notificationSettings.catId, id)),
    db.delete(cats).where(eq(cats.id, id)),
    // 最後の猫を削除して猫のいなくなった家に、ごはんの時間の通知を残さない
    dismissFeedingNotificationsOfCatlessHouseholds(db, userId),
  ]);
}
