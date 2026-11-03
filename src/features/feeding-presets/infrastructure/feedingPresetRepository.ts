import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedingPresetItems,
  feedingPresets,
  householdMembers,
} from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/infrastructure/queries";
import type { FeedingPresetItemContent } from "../domain/feedingPreset";
import type { FeedingPresetRepository } from "../domain/feedingPresetRepository";

/** `userId` が家のメンバーであるときだけ 1 行を返す、INSERT ... SELECT の取得元 */
function memberRow(householdId: string, userId: string) {
  return and(
    eq(householdMembers.householdId, householdId),
    eq(householdMembers.userId, userId),
  );
}

/** D1 に保存する `FeedingPresetRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createFeedingPresetRepository(
  d1?: D1Database,
): FeedingPresetRepository {
  const db = getDb(d1);

  // 判定と書き込みの間に家から外された場合に明細だけが書き換わらないよう、明細は 1 行ずつ
  // INSERT ... SELECT にし、プリセットの家のメンバーの行があるときだけ挿入する。1 行ずつのため
  // D1 のバインド上限も超えない。呼び出し側で同じ batch に並べて原子性を保つ。
  // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
  function insertItems(
    presetId: string,
    householdId: string,
    userId: string,
    items: FeedingPresetItemContent[],
  ) {
    return items.map((item) =>
      db.insert(feedingPresetItems).select((qb) =>
        qb
          .select({
            id: sql`${crypto.randomUUID()}`.as("id"),
            presetId: sql`${presetId}`.as("preset_id"),
            foodProductId: sql`${item.foodProductId}`.as("food_product_id"),
            givenAmountG: sql`${item.givenAmountG ?? null}`.as(
              "given_amount_g",
            ),
            givenAmountLevel: sql`${item.givenAmountLevel ?? null}`.as(
              "given_amount_level",
            ),
            sortOrder: sql`${item.sortOrder ?? 0}`.as("sort_order"),
          })
          .from(householdMembers)
          .where(memberRow(householdId, userId)),
      ),
    );
  }

  return {
    async findHouseholdIdForMember(userId, id) {
      const [row] = await db
        .select({ householdId: feedingPresets.householdId })
        .from(feedingPresets)
        .innerJoin(
          householdMembers,
          eq(feedingPresets.householdId, householdMembers.householdId),
        )
        .where(
          and(eq(feedingPresets.id, id), eq(householdMembers.userId, userId)),
        )
        .limit(1);
      return row?.householdId ?? null;
    },

    async addForMember(userId, householdId, content) {
      const presetId = crypto.randomUUID();
      // プリセットも明細と同じく、登録先の家のメンバーの行があるときだけ挿入する
      const [created] = await db.batch([
        db
          .insert(feedingPresets)
          .select((qb) =>
            qb
              .select({
                id: sql`${presetId}`.as("id"),
                householdId: householdMembers.householdId,
                name: sql`${content.name}`.as("name"),
                mode: sql`${content.mode}`.as("mode"),
                createdAt: sql`(unixepoch())`.as("created_at"),
                updatedAt: sql`(unixepoch())`.as("updated_at"),
              })
              .from(householdMembers)
              .where(memberRow(householdId, userId)),
          )
          .returning({ id: feedingPresets.id }),
        ...insertItems(presetId, householdId, userId, content.items),
      ]);
      return created.length > 0 ? presetId : null;
    },

    async updateForMember(userId, householdId, id, content) {
      // 更新・明細の削除と挿入のいずれも、プリセットの家のメンバーであることを文の中で確かめる
      // （家は登録後に変わらない）
      const [updated] = await db.batch([
        db
          .update(feedingPresets)
          .set({
            name: content.name,
            mode: content.mode,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(feedingPresets.id, id),
              isHouseholdMemberCondition(feedingPresets.householdId, userId),
            ),
          )
          .returning({ id: feedingPresets.id }),
        db
          .delete(feedingPresetItems)
          .where(
            and(
              eq(feedingPresetItems.presetId, id),
              isHouseholdMemberCondition(householdId, userId),
            ),
          ),
        ...insertItems(id, householdId, userId, content.items),
      ]);
      return updated.length > 0;
    },

    async removeForMember(userId, householdId, id) {
      await db.batch([
        db
          .delete(feedingPresetItems)
          .where(
            and(
              eq(feedingPresetItems.presetId, id),
              isHouseholdMemberCondition(householdId, userId),
            ),
          ),
        db
          .delete(feedingPresets)
          .where(
            and(
              eq(feedingPresets.id, id),
              isHouseholdMemberCondition(feedingPresets.householdId, userId),
            ),
          ),
      ]);
    },
  };
}
