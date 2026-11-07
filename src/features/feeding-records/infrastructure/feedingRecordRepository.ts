import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import {
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  notifications,
} from "@/db/schema";
import type { FeedingRecordItemContent } from "../domain/feedingRecord";
import type { FeedingRecordRepository } from "../domain/feedingRecordRepository";

/** INSERT ... SELECT の取得元。猫がまだ `householdId` の家にいるときだけ 1 行を返す */
function catInHouseholdRow(catId: string, householdId: string) {
  return and(eq(cats.id, catId), eq(cats.householdId, householdId));
}

/** 猫がまだ `householdId` の家にいるときだけ真になる条件（UPDATE・DELETE の WHERE に含める） */
function catInHouseholdCondition(catId: string, householdId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${cats}
    WHERE ${cats.id} = ${catId} AND ${cats.householdId} = ${householdId}
  )`;
}

/**
 * 猫の記録が削除されずにあるときだけ真になる条件。記録の更新と同じ batch に並べる明細・通知の文に含め、
 * 確認の後に記録が論理削除された場合に、明細の入れ直しや通知の完了だけが通らないようにする
 * （記録の追加では、同じ batch の先頭で挿入した記録を見る）
 */
function liveRecordCondition(catId: string, feedingRecordId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${feedingRecords}
    WHERE ${feedingRecords.id} = ${feedingRecordId}
      AND ${feedingRecords.catId} = ${catId}
      AND ${feedingRecords.deletedAt} IS NULL
  )`;
}

/** `timestamp` 列に INSERT ... SELECT で入れる値（UNIX 秒） */
function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

/** D1 に保存する `FeedingRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createFeedingRecordRepository(
  d1?: D1Database,
): FeedingRecordRepository {
  const db = getDb(d1);

  // 明細は 1 行ずつ INSERT ... SELECT にし、猫が確認した時点の家にいるときだけ挿入する。1 行ずつのため
  // D1 のバインド上限も超えない。呼び出し側で同じ batch に並べて原子性を保つ。
  // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
  function insertItems(
    feedingRecordId: string,
    catId: string,
    householdId: string,
    items: FeedingRecordItemContent[],
  ) {
    return items.map((item) =>
      db.insert(feedingRecordItems).select((qb) =>
        qb
          .select({
            id: sql`${crypto.randomUUID()}`.as("id"),
            feedingRecordId: sql`${feedingRecordId}`.as("feeding_record_id"),
            foodProductId: sql`${item.foodProductId}`.as("food_product_id"),
            givenAmountG: sql`${item.givenAmountG ?? null}`.as(
              "given_amount_g",
            ),
            leftoverAmountG: sql`${item.leftoverAmountG ?? null}`.as(
              "leftover_amount_g",
            ),
            estimatedIntakeG: sql`${item.estimatedIntakeG ?? null}`.as(
              "estimated_intake_g",
            ),
            estimatedKcal: sql`${item.estimatedKcal ?? null}`.as(
              "estimated_kcal",
            ),
            givenAmountLevel: sql`${item.givenAmountLevel ?? null}`.as(
              "given_amount_level",
            ),
            leftoverLevel: sql`${item.leftoverLevel ?? null}`.as(
              "leftover_level",
            ),
            sortOrder: sql`${item.sortOrder ?? 0}`.as("sort_order"),
          })
          .from(cats)
          .where(
            and(
              catInHouseholdRow(catId, householdId),
              liveRecordCondition(catId, feedingRecordId),
            ),
          ),
      ),
    );
  }

  /** 家の未対応のごはんの時間の通知を完了にする文。記録の保存と同じ batch に並べる */
  function completeNotifications(
    catId: string,
    householdId: string,
    feedingRecordId: string,
    complete: boolean,
  ) {
    if (!complete) {
      return [];
    }
    return [
      db
        .update(notifications)
        .set({ status: "done", updatedAt: new Date() })
        .where(
          and(
            eq(notifications.householdId, householdId),
            inArray(notifications.kind, [
              "feeding_time",
              "feeding_not_recorded",
            ]),
            inArray(notifications.status, ["pending", "snoozed"]),
            catInHouseholdCondition(catId, householdId),
            liveRecordCondition(catId, feedingRecordId),
          ),
        ),
    ];
  }

  return {
    async findFoodProducts(ids) {
      return db
        .select({
          id: foodProducts.id,
          householdId: foodProducts.householdId,
          kcalPer100g: foodProducts.kcalPer100g,
        })
        .from(foodProducts)
        .where(inArray(foodProducts.id, ids));
    },

    async findOccurredAtForCat(catId, id) {
      const [row] = await db
        .select({ occurredAt: feedingRecords.occurredAt })
        .from(feedingRecords)
        .where(
          and(
            eq(feedingRecords.id, id),
            eq(feedingRecords.catId, catId),
            isNull(feedingRecords.deletedAt),
          ),
        )
        .limit(1);
      return row?.occurredAt ?? null;
    },

    async addWhileCatInHousehold(
      catId,
      householdId,
      content,
      completeNotificationsOnSave,
      actor,
    ) {
      const feedingRecordId = crypto.randomUUID();
      // 記録も明細と同じく、猫が確認した時点の家にいるときだけ挿入する
      const [created] = await db.batch([
        db
          .insert(feedingRecords)
          .select((qb) =>
            qb
              .select({
                id: sql`${feedingRecordId}`.as("id"),
                catId: cats.id,
                occurredAt: sql`${toUnixSeconds(content.occurredAt)}`.as(
                  "occurred_at",
                ),
                mode: sql`${content.mode}`.as("mode"),
                createdAt: sql`(unixepoch())`.as("created_at"),
                updatedAt: sql`(unixepoch())`.as("updated_at"),
                deletedAt: sql`null`.as("deleted_at"),
              })
              .from(cats)
              .where(catInHouseholdRow(catId, householdId)),
          )
          .returning({ id: feedingRecords.id }),
        insertRecordChangeLog(
          db,
          {
            recordType: "feeding_record",
            recordId: feedingRecordId,
            action: "create",
            actor,
          },
          liveRecordCondition(catId, feedingRecordId),
        ),
        ...insertItems(feedingRecordId, catId, householdId, content.items),
        ...completeNotifications(
          catId,
          householdId,
          feedingRecordId,
          completeNotificationsOnSave,
        ),
      ]);
      return created.length > 0 ? feedingRecordId : null;
    },

    async updateWhileCatInHousehold(
      catId,
      householdId,
      id,
      content,
      completeNotificationsOnSave,
      actor,
    ) {
      // 更新・明細の削除と挿入・通知の完了のいずれも、猫が確認した時点の家にいて、
      // 記録が削除されていないときだけ行う
      const [updated] = await db.batch([
        db
          .update(feedingRecords)
          .set({
            occurredAt: content.occurredAt,
            mode: content.mode,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(feedingRecords.id, id),
              isNull(feedingRecords.deletedAt),
              catInHouseholdCondition(catId, householdId),
            ),
          )
          .returning({ id: feedingRecords.id }),
        insertRecordChangeLog(
          db,
          {
            recordType: "feeding_record",
            recordId: id,
            action: "update",
            actor,
          },
          and(
            catInHouseholdCondition(catId, householdId),
            liveRecordCondition(catId, id),
          ),
        ),
        db
          .delete(feedingRecordItems)
          .where(
            and(
              eq(feedingRecordItems.feedingRecordId, id),
              catInHouseholdCondition(catId, householdId),
              liveRecordCondition(catId, id),
            ),
          ),
        ...insertItems(id, catId, householdId, content.items),
        ...completeNotifications(
          catId,
          householdId,
          id,
          completeNotificationsOnSave,
        ),
      ]);
      return updated.length > 0;
    },

    async remove(catId, id, actor) {
      // 論理削除。明細は記録の中身として残す（削除済みの記録の明細は、記録と一緒に読み取りから除く）。
      // 削除の後は記録が条件に一致しないため、履歴を先に追加する
      const [, deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          {
            recordType: "feeding_record",
            recordId: id,
            action: "delete",
            actor,
          },
          liveRecordCondition(catId, id),
        ),
        db
          .update(feedingRecords)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(feedingRecords.id, id),
              eq(feedingRecords.catId, catId),
              isNull(feedingRecords.deletedAt),
            ),
          )
          .returning({ id: feedingRecords.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
