import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  feedingSchedules,
  householdMembers,
  notifications,
} from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/infrastructure/queries";
import {
  FEEDING_NOTIFICATION_KINDS,
  type FeedingNotificationKind,
} from "../domain/feedingSchedule";
import type { FeedingScheduleRepository } from "../domain/feedingScheduleRepository";

type Db = ReturnType<typeof getDb>;

/**
 * ごはんの時間の、指定した種類の未対応（`pending`・`snoozed`）の通知を無視にする UPDATE 文。
 * ごはんの時間の変更・削除と同じ batch に並べ、もう出さない通知が通知センターに残ったり、
 * Push が送られたりしないようにする。対応済みの通知は履歴として残す。
 * ごはんの時間がその家のものであることと、家のメンバーであることを WHERE に含め、
 * 変更・削除が通らない場合は通知も変えない
 */
function dismissOpenNotificationsOf(
  db: Db,
  householdId: string,
  userId: string,
  scheduleId: string,
  kinds: FeedingNotificationKind[],
) {
  return db
    .update(notifications)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(notifications.householdId, householdId),
        eq(notifications.referenceId, scheduleId),
        inArray(notifications.kind, kinds),
        inArray(notifications.status, ["pending", "snoozed"]),
        sql`EXISTS (
          SELECT 1 FROM ${feedingSchedules}
          WHERE ${feedingSchedules.id} = ${scheduleId}
            AND ${feedingSchedules.householdId} = ${householdId}
        )`,
        isHouseholdMemberCondition(householdId, userId),
      ),
    );
}

/**
 * 猫が 1 匹もいない家の、ごはんの時間の未対応（`pending`・`snoozed`）の通知を無視にする UPDATE 文。
 * 通知の生成は猫のいない家を対象にしないが、生成済みの通知は家の最後の猫を削除しても
 * 残り、記録できる猫がいないのに Push が送られてしまう。猫の削除と同じ batch の、
 * 猫の行を消す文の後に並べる。どの家の猫がいなくなったかを先に読まずに済むよう、操作する
 * ユーザーが所属する家のうち、その時点で猫のいない家をまとめて対象にする（猫のいない家に
 * 未対応のごはんの通知が残っている必要はないため、削除が通らなかったときに実行しても
 * 問題ない）
 */
export function dismissFeedingNotificationsOfCatlessHouseholds(
  db: Db,
  userId: string,
) {
  return db
    .update(notifications)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        inArray(notifications.kind, ["feeding_time", "feeding_not_recorded"]),
        inArray(notifications.status, ["pending", "snoozed"]),
        isNotNull(notifications.householdId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${cats}
          WHERE ${cats.householdId} = ${notifications.householdId}
        )`,
        isHouseholdMemberCondition(notifications.householdId, userId),
      ),
    );
}

/** D1 に保存する `FeedingScheduleRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createFeedingScheduleRepository(
  d1?: D1Database,
): FeedingScheduleRepository {
  const db = getDb(d1);
  const ofMember = (householdId: string, userId: string, id: string) =>
    and(
      eq(feedingSchedules.id, id),
      eq(feedingSchedules.householdId, householdId),
      isHouseholdMemberCondition(householdId, userId),
    );

  return {
    async existsAtTime(householdId, time) {
      const [existing] = await db
        .select({ id: feedingSchedules.id })
        .from(feedingSchedules)
        .where(
          and(
            eq(feedingSchedules.householdId, householdId),
            eq(feedingSchedules.time, time),
          ),
        )
        .limit(1);
      return existing != null;
    },

    async addForMember(householdId, userId, content) {
      // メンバーかどうかの判定と追加を 1 文にするため、`household_members` からの INSERT ... SELECT にする。
      // INSERT ... SELECT では列の既定値が使われないため、全カラムの値をテーブル定義の順に明示する
      const created = await db
        .insert(feedingSchedules)
        .select(
          db
            .select({
              id: sql`${crypto.randomUUID()}`.as("id"),
              householdId: householdMembers.householdId,
              time: sql`${content.time}`.as("time"),
              notifyAtTime: sql`${content.notifyAtTime ? 1 : 0}`.as(
                "notify_at_time",
              ),
              remindIfNotRecorded:
                sql`${content.remindIfNotRecorded ? 1 : 0}`.as(
                  "remind_if_not_recorded",
                ),
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
        // 呼び出し側の確認と追加の間に、同じ時刻が別のリクエストで追加された場合は何もしない
        .onConflictDoNothing()
        .returning({ id: feedingSchedules.id });
      return created.length > 0;
    },

    async updateNotifyForMember(
      householdId,
      userId,
      id,
      settings,
      dismissKinds,
    ) {
      const updateSchedule = db
        .update(feedingSchedules)
        .set({ ...settings, updatedAt: new Date() })
        .where(ofMember(householdId, userId, id))
        .returning({ id: feedingSchedules.id });

      const updated =
        dismissKinds.length === 0
          ? await updateSchedule
          : (
              await db.batch([
                dismissOpenNotificationsOf(
                  db,
                  householdId,
                  userId,
                  id,
                  dismissKinds,
                ),
                updateSchedule,
              ])
            )[1];
      return updated.length > 0;
    },

    async removeForMember(householdId, userId, id) {
      // 通知の UPDATE はごはんの時間が残っていることを条件にするため、削除より先に並べる
      const [, deleted] = await db.batch([
        dismissOpenNotificationsOf(
          db,
          householdId,
          userId,
          id,
          FEEDING_NOTIFICATION_KINDS,
        ),
        db
          .delete(feedingSchedules)
          .where(ofMember(householdId, userId, id))
          .returning({ id: feedingSchedules.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
