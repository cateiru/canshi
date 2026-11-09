import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deleteRecordChangeLogsOf } from "@/db/recordChangeLog";
import {
  cats,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  feedingPresetItems,
  feedingPresets,
  feedingSchedules,
  foodProducts,
  householdInvitations,
  householdMembers,
  households,
  notifications,
} from "@/db/schema";
import type { HouseholdRepository } from "../domain/householdRepository";

/**
 * `userId` がその家のオーナーであるときだけ真になる条件。読んでから書く方式だと、
 * 判定と更新の間にオーナーを移譲された場合に元オーナーの操作が通ってしまうため、
 * 更新・削除の WHERE に含めて 1 文で判定する
 */
export function isOwnerCondition(householdId: string, userId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${householdMembers} AS owner
    WHERE owner.household_id = ${householdId}
      AND owner.user_id = ${userId}
      AND owner.role = 'owner'
  )`;
}

/** D1 に保存する `HouseholdRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createHouseholdRepository(
  d1?: D1Database,
): HouseholdRepository {
  const db = getDb(d1);
  return {
    async addWithOwner(ownerUserId, name) {
      // 家だけが作られてオーナーのいない家が残らないよう、家とメンバーの追加は
      // 1 つの batch（トランザクション）で行う
      const householdId = crypto.randomUUID();
      await db.batch([
        db.insert(households).values({ id: householdId, name }),
        db
          .insert(householdMembers)
          .values({ householdId, userId: ownerUserId, role: "owner" }),
      ]);
      return householdId;
    },

    async renameAsOwner(householdId, ownerUserId, name) {
      const updated = await db
        .update(households)
        .set({ name, updatedAt: new Date() })
        .where(
          and(
            eq(households.id, householdId),
            isOwnerCondition(householdId, ownerUserId),
          ),
        )
        .returning({ id: households.id });
      return updated.length > 0;
    },

    async removeMemberAsOwner(householdId, ownerUserId, memberUserId) {
      const deleted = await db
        .delete(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, memberUserId),
            eq(householdMembers.role, "member"),
            isOwnerCondition(householdId, ownerUserId),
          ),
        )
        .returning({ userId: householdMembers.userId });
      return deleted.length > 0;
    },

    async removeSelfAsMember(householdId, userId) {
      const deleted = await db
        .delete(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, userId),
            eq(householdMembers.role, "member"),
          ),
        )
        .returning({ userId: householdMembers.userId });
      return deleted.length > 0;
    },

    async removeAsOwner(householdId, ownerUserId) {
      // 確認から削除までの間に、ほかのメンバーが猫を登録したりオーナーを移譲したりしうるため、
      // オーナーであること・猫がいないことは、batch のすべての文の WHERE で確かめる。
      // 条件を満たさないときは、どの文も行を消さない（batch の途中で条件は変わらない）
      const canRemove = and(
        isOwnerCondition(householdId, ownerUserId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${cats} WHERE ${cats.householdId} = ${householdId}
        )`,
      );
      const householdExpenseIds = db
        .select({ id: expenseRecords.id })
        .from(expenseRecords)
        .where(eq(expenseRecords.householdId, householdId));
      const householdPresetIds = db
        .select({ id: feedingPresets.id })
        .from(feedingPresets)
        .where(eq(feedingPresets.householdId, householdId));

      // 外部キーはすべて ON DELETE no action のため、参照する側から順に消す。猫がいない家だけを
      // 削除するため、猫に紐付く記録（`cat_id` を持つ行）は対象にならない
      // 結果は文の順に並ぶ。ID を返す支出記録（4 番目）・ごはん商品（7 番目）・家（12 番目）だけを取り出す
      const [
        ,
        ,
        ,
        deletedExpenses,
        ,
        ,
        deletedFoodProducts,
        ,
        ,
        ,
        ,
        deletedHouseholds,
      ] = await db.batch([
        // 支出記録は論理削除したものも含めて物理削除するため、その履歴も消す。
        // 記録を消すと対象を選べなくなるため先に消す
        deleteRecordChangeLogsOf(
          db,
          "expense",
          expenseRecords,
          and(eq(expenseRecords.householdId, householdId), canRemove),
        ),
        // 猫がいない家の支出に猫・通院記録の紐付けは残らないはずだが、残っていれば支出より先に消す
        db
          .delete(expenseRecordCats)
          .where(
            and(
              inArray(expenseRecordCats.expenseRecordId, householdExpenseIds),
              canRemove,
            ),
          ),
        db
          .delete(expenseRecordHospitalVisits)
          .where(
            and(
              inArray(
                expenseRecordHospitalVisits.expenseRecordId,
                householdExpenseIds,
              ),
              canRemove,
            ),
          ),
        // 画像を消す対象を、batch で実際に削除した行から決めるため、ID を返す
        db
          .delete(expenseRecords)
          .where(and(eq(expenseRecords.householdId, householdId), canRemove))
          .returning({ id: expenseRecords.id }),
        // プリセットの明細はプリセットとごはん商品の両方を参照するため、どちらよりも先に消す
        db
          .delete(feedingPresetItems)
          .where(
            and(
              inArray(feedingPresetItems.presetId, householdPresetIds),
              canRemove,
            ),
          ),
        db
          .delete(feedingPresets)
          .where(and(eq(feedingPresets.householdId, householdId), canRemove)),
        // ほかの家のごはん記録の明細から参照されている商品が残っていれば、外部キー制約で
        // batch 全体が失敗し、何も削除されない
        db
          .delete(foodProducts)
          .where(and(eq(foodProducts.householdId, householdId), canRemove))
          .returning({ id: foodProducts.id }),
        db
          .delete(feedingSchedules)
          .where(and(eq(feedingSchedules.householdId, householdId), canRemove)),
        // 家についての通知（ごはんの時間など）。送信の記録（push_deliveries）は ON DELETE CASCADE で消える
        db
          .delete(notifications)
          .where(and(eq(notifications.householdId, householdId), canRemove)),
        db
          .delete(householdInvitations)
          .where(
            and(eq(householdInvitations.householdId, householdId), canRemove),
          ),
        // オーナーの行が条件の判定に使われるため、メンバーは家本体の直前に消す
        // （SQLite は消す行を先に決めてから消すため、オーナーの行も含めて 1 文で消せる）
        db
          .delete(householdMembers)
          .where(and(eq(householdMembers.householdId, householdId), canRemove)),
        // オーナーの行はもう消えているため、オーナーであることの代わりに、メンバーが残っていない
        // （上の文でメンバーを消せた）ことを確かめる
        db
          .delete(households)
          .where(
            and(
              eq(households.id, householdId),
              sql`NOT EXISTS (
                SELECT 1 FROM ${householdMembers}
                WHERE ${householdMembers.householdId} = ${householdId}
              )`,
              sql`NOT EXISTS (
                SELECT 1 FROM ${cats} WHERE ${cats.householdId} = ${householdId}
              )`,
            ),
          )
          .returning({ id: households.id }),
      ]);
      if (deletedHouseholds.length === 0) {
        return null;
      }
      return {
        foodProductIds: deletedFoodProducts.map(({ id }) => id),
        expenseRecordIds: deletedExpenses.map(({ id }) => id),
      };
    },

    async transferOwnership(householdId, currentOwnerUserId, nextOwnerUserId) {
      const updated = await db
        .update(householdMembers)
        .set({
          role: sql`CASE WHEN ${householdMembers.userId} = ${nextOwnerUserId} THEN 'owner' ELSE 'member' END`,
        })
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            inArray(householdMembers.userId, [
              currentOwnerUserId,
              nextOwnerUserId,
            ]),
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
      return updated.length === 2;
    },
  };
}
