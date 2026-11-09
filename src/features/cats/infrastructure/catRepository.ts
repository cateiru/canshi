import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deleteRecordChangeLogsOf } from "@/db/recordChangeLog";
import {
  brushingRecords,
  cats,
  cleaningRecords,
  cleaningTargets,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  feedingRecordItems,
  feedingRecords,
  hospitalVisits,
  householdMembers,
  medicationDoses,
  medications,
  memoRecords,
  notificationSettings,
  notifications,
  poopRecords,
  shampooRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import { dismissFeedingNotificationsOfCatlessHouseholds } from "@/features/feeding-schedules/infrastructure/feedingScheduleRepository";
import type { CatRepository } from "../domain/catRepository";

/** D1 に保存する `CatRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createCatRepository(d1?: D1Database): CatRepository {
  const db = getDb(d1);
  return {
    async addForMember(userId, values) {
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
              neuterStatus: sql`${values.neuterStatus ?? null}`.as(
                "neuter_status",
              ),
              coatColor: sql`${values.coatColor ?? null}`.as("coat_color"),
              coatPattern: sql`${values.coatPattern ?? null}`.as(
                "coat_pattern",
              ),
              coatWhite: sql`${values.coatWhite ?? null}`.as("coat_white"),
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
    },

    async updateForMember(userId, catId, values) {
      // 猫を飼う家は登録後は変えられないため、プロフィールの列だけを書き換える
      // （型にない `householdId` などが実行時に混ざっても、ほかの列は書き換えない）
      const updated = await db
        .update(cats)
        .set({
          name: values.name,
          sex: values.sex,
          birthDate: values.birthDate,
          birthDatePrecision: values.birthDatePrecision,
          breed: values.breed,
          adoptedAt: values.adoptedAt,
          neuterStatus: values.neuterStatus,
          coatColor: values.coatColor,
          coatPattern: values.coatPattern,
          coatWhite: values.coatWhite,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cats.id, catId),
            sql`EXISTS (
              SELECT 1 FROM ${householdMembers}
              WHERE ${householdMembers.householdId} = ${cats.householdId}
                AND ${householdMembers.userId} = ${userId}
            )`,
          ),
        )
        .returning({ id: cats.id });
      return updated.length > 0;
    },

    async markNeuteredForMember(userId, catId) {
      const updated = await db
        .update(cats)
        .set({ neuterStatus: "neutered", updatedAt: new Date() })
        .where(
          and(
            eq(cats.id, catId),
            sql`EXISTS (
              SELECT 1 FROM ${householdMembers}
              WHERE ${householdMembers.householdId} = ${cats.householdId}
                AND ${householdMembers.userId} = ${userId}
            )`,
          ),
        )
        .returning({ id: cats.id });
      return updated.length > 0;
    },

    async removeForUser(userId, id) {
      // 各記録テーブルは cats.id への外部キー制約（ON DELETE no action）を持つため、
      // 猫本体より先に紐づく記録を削除しておく。symptoms と hospital_visits は
      // 互いを参照しうるため、削除前にまず双方の紐付け（hospital_visit_id /
      // symptom_id）を解除して循環を断ち切る。medications.symptom_id が
      // symptoms を参照しているため、medications（と、それに依存する
      // medicationDoses）は symptoms より先に削除する。途中で失敗して猫だけ残る
      // /一部の記録だけ消えるような中途半端な状態にならないよう、1つの
      // db.batch でまとめて原子的に実行する。記録は論理削除したものも含めてすべて物理削除する
      await db.batch([
        // 記録を物理削除するため、その履歴も消す。記録を消すと対象を選べなくなるため先に消す。
        // 支出記録は猫を削除しても残すため、履歴も残す
        deleteRecordChangeLogsOf(
          db,
          "feeding_record",
          feedingRecords,
          eq(feedingRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "poop_record",
          poopRecords,
          eq(poopRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "weight_record",
          weightRecords,
          eq(weightRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "vomit_record",
          vomitRecords,
          eq(vomitRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "water_record",
          waterRecords,
          eq(waterRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "shampoo_record",
          shampooRecords,
          eq(shampooRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "brushing_record",
          brushingRecords,
          eq(brushingRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "memo_record",
          memoRecords,
          eq(memoRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "cleaning_record",
          cleaningRecords,
          eq(cleaningRecords.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "hospital_visit",
          hospitalVisits,
          eq(hospitalVisits.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "medication_dose",
          medicationDoses,
          eq(medicationDoses.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "medication",
          medications,
          eq(medications.catId, id),
        ),
        deleteRecordChangeLogsOf(
          db,
          "symptom",
          symptoms,
          eq(symptoms.catId, id),
        ),
        // feeding_record_items は feeding_records を参照するため、記録より先に明細を削除する
        db
          .delete(feedingRecordItems)
          .where(
            inArray(
              feedingRecordItems.feedingRecordId,
              db
                .select({ id: feedingRecords.id })
                .from(feedingRecords)
                .where(eq(feedingRecords.catId, id)),
            ),
          ),
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
        db
          .delete(notificationSettings)
          .where(eq(notificationSettings.catId, id)),
        db.delete(cats).where(eq(cats.id, id)),
        // 最後の猫を削除して猫のいなくなった家に、ごはんの時間の通知を残さない
        dismissFeedingNotificationsOfCatlessHouseholds(db, userId),
      ]);
    },
  };
}
