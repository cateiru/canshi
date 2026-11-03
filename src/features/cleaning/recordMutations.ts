import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cleaningRecords, cleaningTargets, notifications } from "@/db/schema";
import { NOTIFY_TIMEZONE } from "@/features/notifications/defaults";
import {
  getNaiveLocalDateParts,
  getNaiveLocalNow,
  localDateToUtcMidnight,
} from "@/features/notifications/rules/localDate";
import { combineDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { calculateNextDueAt } from "./calculations";
import type { CleaningRecordFormInput } from "./recordSchema";

/*
 * 記録の保存。画面（`./recordActions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

type CleaningTargetForRecord = Pick<
  typeof cleaningTargets.$inferSelect,
  "id" | "frequencyValue" | "frequencyUnit" | "notifyTime"
>;

const MS_PER_MINUTE = 60 * 1000;

const targetColumns = {
  id: cleaningTargets.id,
  frequencyValue: cleaningTargets.frequencyValue,
  frequencyUnit: cleaningTargets.frequencyUnit,
  notifyTime: cleaningTargets.notifyTime,
};

function toValues(data: CleaningRecordFormInput) {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    memo: data.memo ?? null,
  };
}

/** 猫の掃除対象。`activeOnly` なら有効な対象に限る。見つからなければ null */
async function findTarget(
  db: ReturnType<typeof getDb>,
  catId: string,
  cleaningTargetId: string,
  { activeOnly }: { activeOnly: boolean },
): Promise<CleaningTargetForRecord | null> {
  const [target] = await db
    .select(targetColumns)
    .from(cleaningTargets)
    .where(
      and(
        eq(cleaningTargets.id, cleaningTargetId),
        eq(cleaningTargets.catId, catId),
        ...(activeOnly ? [eq(cleaningTargets.isActive, true)] : []),
      ),
    )
    .limit(1);
  return target ?? null;
}

/**
 * 掃除を記録したら、その掃除対象の未対応の掃除の通知（`cleaning_due`）はもう対応する必要が
 * ないため完了にする文。呼び出し側で記録の保存と同じ batch に並べる。
 *
 * 次のどちらかの記録では完了にせず、空の配列を返す。
 * - 先の日時の記録。まだ掃除していないため（ごはん記録の `completeFeedingNotifications` と同じ）。
 *   実施日時は naive UTC のため、現在時刻もローカル時計の数字の naive UTC にして比べる
 * - 古い日時の記録で、その記録から数えた次回予定日が通知の予定日を過ぎないもの。
 *   さかのぼって記録しただけで、通知の予定日の掃除はまだしていないため。
 *   通知は予定日ごとに 1 件（`dedupe_key`）のため、ここで完了にすると同じ予定日には
 *   もう通知されなくなる
 *
 * 通知の予定日（`due_at`）は予定日を UTC 0 時にしたもの（`localDateToUtcMidnight`）のため、
 * 記録から数えた次回予定日も同じ形にそろえ、それより前の予定日の通知を完了にする。
 * 同じ対象に残っている古い予定日の通知もまとめて完了にする
 */
function completeCleaningNotifications(
  db: ReturnType<typeof getDb>,
  catId: string,
  target: CleaningTargetForRecord,
  performedAt: Date,
) {
  // `getNaiveLocalNow` は分単位で切り捨てるため、記録の日時も分単位にそろえて比べる。
  // 「今すぐ掃除した」の記録（`getNaiveUtcNow`）は秒を持ち、そのまま比べると先の日時になる
  if (
    Math.floor(performedAt.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE >
    getNaiveLocalNow(new Date(), NOTIFY_TIMEZONE).getTime()
  ) {
    return [];
  }
  const nextDueAt = calculateNextDueAt(
    performedAt,
    target.frequencyValue,
    target.frequencyUnit,
    target.notifyTime,
  );
  if (nextDueAt == null) {
    return [];
  }
  return [
    db
      .update(notifications)
      .set({ status: "done", updatedAt: new Date() })
      .where(
        and(
          eq(notifications.catId, catId),
          eq(notifications.kind, "cleaning_due"),
          eq(notifications.referenceId, target.id),
          inArray(notifications.status, ["pending", "snoozed"]),
          lt(
            notifications.dueAt,
            localDateToUtcMidnight(getNaiveLocalDateParts(nextDueAt)),
          ),
        ),
      ),
  ];
}

/**
 * 記録を追加し、その ID を返す。掃除対象が猫のもので、有効なときだけ追加し、そうでなければ null。
 * 掃除対象の ID は URL・AI から任意の値を渡せるため、他猫や無効化済みの掃除対象に記録が
 * 紐付いてしまうのを防ぐ（無効対象は編集・記録閲覧のみが仕様のため新規登録は拒否する）。
 * 掃除の通知が来ていれば、記録とあわせて完了にする（`completeCleaningNotifications`）
 */
export async function createCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  data: CleaningRecordFormInput,
  d1?: D1Database,
): Promise<string | null> {
  return insertCleaningRecord(
    getDb(d1),
    catId,
    cleaningTargetId,
    toValues(data),
  );
}

/**
 * 「今すぐ掃除した」の記録を追加し、その ID を返す。条件は `createCleaningRecord` と同じ。
 * 手入力（combineDateTimeUtc）と同じ「naive UTC」の時刻モデルに揃える。
 * サーバー側の new Date() は実際の UTC のため、そのまま保存すると
 * JST の時計とずれた時刻で記録されてしまう
 */
export async function createCleaningRecordNow(
  catId: string,
  cleaningTargetId: string,
  d1?: D1Database,
): Promise<string | null> {
  return insertCleaningRecord(getDb(d1), catId, cleaningTargetId, {
    performedAt: getNaiveUtcNow(),
    memo: null,
  });
}

async function insertCleaningRecord(
  db: ReturnType<typeof getDb>,
  catId: string,
  cleaningTargetId: string,
  values: { performedAt: Date; memo: string | null },
): Promise<string | null> {
  const target = await findTarget(db, catId, cleaningTargetId, {
    activeOnly: true,
  });
  if (!target) {
    return null;
  }

  const id = crypto.randomUUID();
  await db.batch([
    db
      .insert(cleaningRecords)
      .values({ id, catId, cleaningTargetId, ...values }),
    ...completeCleaningNotifications(db, catId, target, values.performedAt),
  ]);
  return id;
}

/**
 * 猫の掃除対象の記録を更新する。見つからなければ false。
 * 実施日時を変えたときは、その日時に記録したのと同じく掃除の通知を完了にする（先の日時から
 * 今以前に直したときなど）。メモだけを直したときは、過去の記録の修正で今の通知を完了にしないよう
 * 何もしない（ごはん記録の `updateFeedingRecord` と同じ）
 */
export async function updateCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  id: string,
  data: CleaningRecordFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const db = getDb(d1);
  const recordCondition = and(
    eq(cleaningRecords.id, id),
    eq(cleaningRecords.catId, catId),
    eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
  );
  const [existing] = await db
    .select({ performedAt: cleaningRecords.performedAt })
    .from(cleaningRecords)
    .where(recordCondition)
    .limit(1);
  // 無効化済みの対象の記録も編集はできる
  const target = await findTarget(db, catId, cleaningTargetId, {
    activeOnly: false,
  });
  if (!existing || !target) {
    return false;
  }

  const values = toValues(data);
  const [updated] = await db.batch([
    db
      .update(cleaningRecords)
      .set({ ...values, updatedAt: new Date() })
      .where(recordCondition)
      .returning({ id: cleaningRecords.id }),
    ...(values.performedAt.getTime() === existing.performedAt.getTime()
      ? []
      : completeCleaningNotifications(db, catId, target, values.performedAt)),
  ]);
  return updated.length > 0;
}

/** 掃除対象の記録を削除する。見つからなければ false */
export async function deleteCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .delete(cleaningRecords)
    .where(
      and(
        eq(cleaningRecords.id, id),
        eq(cleaningRecords.catId, catId),
        eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
      ),
    )
    .returning({ id: cleaningRecords.id });
  return result.length > 0;
}
