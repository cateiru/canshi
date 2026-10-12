import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedingSchedules, householdMembers, notifications } from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import type {
  FeedingScheduleFormInput,
  FeedingScheduleNotifyFormInput,
} from "./schema";

export type FeedingScheduleMutationResult =
  | { ok: true }
  | { ok: false; error: string };

const NOT_MEMBER_ERROR = "この家のメンバーではないため変更できませんでした";

/** 家のごはんの時間の一覧。時刻順 */
export async function listFeedingSchedules(
  householdId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  return db
    .select()
    .from(feedingSchedules)
    .where(eq(feedingSchedules.householdId, householdId))
    .orderBy(asc(feedingSchedules.time));
}

/**
 * 家にごはんの時間を追加する。家のメンバーなら誰でも追加できる。同じ家に同じ時刻は
 * 1 つだけ（`feeding_schedules_household_id_time_unique`）。
 * メンバーかどうかの判定と追加を 1 文にするため、`household_members` からの INSERT ... SELECT にする。
 * INSERT ... SELECT では列の既定値が使われないため、全カラムの値をテーブル定義の順に明示する
 */
export async function createFeedingSchedule(
  householdId: string,
  userId: string,
  input: FeedingScheduleFormInput,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const db = getDb(d1);
  const [existing] = await db
    .select({ id: feedingSchedules.id })
    .from(feedingSchedules)
    .where(
      and(
        eq(feedingSchedules.householdId, householdId),
        eq(feedingSchedules.time, input.time),
      ),
    )
    .limit(1);
  if (existing) {
    return { ok: false, error: `${input.time}はすでに追加されています` };
  }

  const created = await db
    .insert(feedingSchedules)
    .select(
      db
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          householdId: householdMembers.householdId,
          time: sql`${input.time}`.as("time"),
          notifyAtTime: sql`${input.notifyAtTime ? 1 : 0}`.as("notify_at_time"),
          remindIfNotRecorded: sql`${input.remindIfNotRecorded ? 1 : 0}`.as(
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
    // 上の確認と追加の間に、同じ時刻が別のリクエストで追加された場合は何もしない
    .onConflictDoNothing()
    .returning({ id: feedingSchedules.id });

  if (created.length === 0) {
    return { ok: false, error: `${input.time}を追加できませんでした` };
  }
  return { ok: true };
}

type FeedingNotificationKind = "feeding_time" | "feeding_not_recorded";

/**
 * ごはんの時間の、指定した種類の未対応（`pending`・`snoozed`）の通知を無視にする UPDATE 文。
 * ごはんの時間の変更・削除と同じ batch に並べ、もう出さない通知が通知センターに残ったり、
 * Push が送られたりしないようにする。対応済みの通知は履歴として残す。
 * ごはんの時間がその家のものであることと、家のメンバーであることを WHERE に含め、
 * 変更・削除が通らない場合は通知も変えない
 */
function dismissOpenNotificationsOf(
  db: ReturnType<typeof getDb>,
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
 * ごはんの時間の通知の設定を変える。家のメンバーなら誰でも変えられる。
 * オフにした種類の未対応の通知は、同じ batch で無視にする
 */
export async function updateFeedingScheduleNotify(
  householdId: string,
  userId: string,
  scheduleId: string,
  input: FeedingScheduleNotifyFormInput,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const db = getDb(d1);
  const disabledKinds: FeedingNotificationKind[] = [
    ...(input.notifyAtTime ? [] : (["feeding_time"] as const)),
    ...(input.remindIfNotRecorded ? [] : (["feeding_not_recorded"] as const)),
  ];
  const updateSchedule = db
    .update(feedingSchedules)
    .set({
      notifyAtTime: input.notifyAtTime,
      remindIfNotRecorded: input.remindIfNotRecorded,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feedingSchedules.id, scheduleId),
        eq(feedingSchedules.householdId, householdId),
        isHouseholdMemberCondition(householdId, userId),
      ),
    )
    .returning({ id: feedingSchedules.id });

  const updated =
    disabledKinds.length === 0
      ? await updateSchedule
      : (
          await db.batch([
            dismissOpenNotificationsOf(
              db,
              householdId,
              userId,
              scheduleId,
              disabledKinds,
            ),
            updateSchedule,
          ])
        )[1];

  if (updated.length === 0) {
    return { ok: false, error: NOT_MEMBER_ERROR };
  }
  return { ok: true };
}

/**
 * ごはんの時間を削除する。家のメンバーなら誰でも削除できる。
 * すでに生成した、この時間の未対応の通知は同じ batch で無視にする。
 * 対応済みの通知は履歴として残す（`notifications.reference_id` には外部キーがない）
 */
export async function deleteFeedingSchedule(
  householdId: string,
  userId: string,
  scheduleId: string,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const db = getDb(d1);
  // 通知の UPDATE はごはんの時間が残っていることを条件にするため、削除より先に並べる
  const [, deleted] = await db.batch([
    dismissOpenNotificationsOf(db, householdId, userId, scheduleId, [
      "feeding_time",
      "feeding_not_recorded",
    ]),
    db
      .delete(feedingSchedules)
      .where(
        and(
          eq(feedingSchedules.id, scheduleId),
          eq(feedingSchedules.householdId, householdId),
          isHouseholdMemberCondition(householdId, userId),
        ),
      )
      .returning({ id: feedingSchedules.id }),
  ]);

  if (deleted.length === 0) {
    return { ok: false, error: NOT_MEMBER_ERROR };
  }
  return { ok: true };
}
