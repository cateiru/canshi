import {
  and,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  householdMembers,
  memoLabels,
  memoRecordLabels,
  memoRecords,
} from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/infrastructure/queries";
import type { MemoLabelRepository } from "../domain/memoLabelRepository";

/** D1 に保存する `MemoLabelRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createMemoLabelRepository(
  d1?: D1Database,
): MemoLabelRepository {
  const db = getDb(d1);
  const ofMember = (userId: string, id: string) =>
    and(
      eq(memoLabels.id, id),
      isHouseholdMemberCondition(memoLabels.householdId, userId),
    );
  /** ラベルが、削除していないメモに付いていない */
  const unused = (id: string) =>
    notExists(
      db
        .select({ id: memoRecords.id })
        .from(memoRecordLabels)
        .innerJoin(
          memoRecords,
          eq(memoRecords.id, memoRecordLabels.memoRecordId),
        )
        .where(
          and(
            eq(memoRecordLabels.memoLabelId, id),
            isNull(memoRecords.deletedAt),
          ),
        ),
    );

  return {
    async addForMember(userId, householdId, content) {
      // 判定と登録の間に家から外された場合に登録が通らないよう、INSERT ... SELECT で
      // 登録先の家のメンバーの行があるときだけ 1 文で挿入する（`createFoodProduct` と同じ）。
      // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする。
      // 同じ名前のラベルがあれば（一意インデックス）挿入せず、呼び出し側で理由を確かめる
      const [created] = await db
        .insert(memoLabels)
        .select((qb) =>
          qb
            .select({
              id: sql`${crypto.randomUUID()}`.as("id"),
              householdId: householdMembers.householdId,
              name: sql`${content.name}`.as("name"),
              createdAt: sql`(unixepoch())`.as("created_at"),
              updatedAt: sql`(unixepoch())`.as("updated_at"),
            })
            .from(householdMembers)
            .where(
              and(
                eq(householdMembers.householdId, householdId),
                eq(householdMembers.userId, userId),
              ),
            ),
        )
        .onConflictDoNothing()
        .returning({ id: memoLabels.id });
      return created?.id ?? null;
    },

    async updateForMember(userId, id, content) {
      const updated = await db
        .update(memoLabels)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            ofMember(userId, id),
            // 一意インデックスの違反で例外にせず、呼び出し側で理由を確かめられるようにする
            sql`NOT EXISTS (
              SELECT 1 FROM ${memoLabels} AS other
              WHERE other.household_id = ${memoLabels.householdId}
                AND other.name = ${content.name}
                AND other.id <> ${memoLabels.id}
            )`,
          ),
        )
        .returning({ id: memoLabels.id });
      return updated.length > 0;
    },

    async removeUnusedForMember(userId, id) {
      // 論理削除したメモの紐付けはラベルを参照したまま残るため、外部キー制約でラベルを削除できるよう、
      // その紐付けだけを先に物理削除する（削除済みのメモは表示しないため、画面は変わらない）。
      // 確認から削除までの間にメモに付けられた場合に備えて、付いていないことはどちらの文でも確かめる
      const [, deleted] = await db.batch([
        db
          .delete(memoRecordLabels)
          .where(
            and(
              eq(memoRecordLabels.memoLabelId, id),
              inArray(
                memoRecordLabels.memoRecordId,
                db
                  .select({ id: memoRecords.id })
                  .from(memoRecords)
                  .where(isNotNull(memoRecords.deletedAt)),
              ),
              exists(
                db
                  .select({ id: memoLabels.id })
                  .from(memoLabels)
                  .where(ofMember(userId, id)),
              ),
              unused(id),
            ),
          ),
        db
          .delete(memoLabels)
          .where(and(ofMember(userId, id), unused(id)))
          .returning({ id: memoLabels.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
