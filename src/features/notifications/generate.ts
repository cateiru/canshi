import {
  and,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lt,
  ne,
  notExists,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  feedingRecords,
  feedingSchedules,
  notifications,
  shampooRecords,
  symptoms,
  weightRecords,
} from "@/db/schema";
import { listAllCats } from "@/features/cats/queries";
import { listCleaningTargetsWithStatus } from "@/features/cleaning/targetQueries";
import { NOTIFY_TIMEZONE } from "./defaults";
import {
  buildHouseholdNotificationMessage,
  buildNotificationMessage,
  type NotificationMessage,
} from "./messages";
import { getResolvedSettingsForCat } from "./queries";
import {
  evaluateNotificationRules,
  type FeedingScheduleForRule,
  type HouseholdNotificationCandidate,
  type OpenSymptom,
  type SymptomOngoingCandidate,
} from "./rules";
import {
  evaluateFeedingSchedule,
  FEEDING_RECORD_LOOKBACK_MS,
  feedingRecordedUntil,
} from "./rules/feedingSchedule";
import { getNaiveLocalNow } from "./rules/localDate";

/** 家 id ごとの、ごはんの時間（`evaluateFeedingSchedule` の入力） */
async function listFeedingSchedulesByHousehold(
  db: ReturnType<typeof getDb>,
): Promise<Map<string, FeedingScheduleForRule[]>> {
  const rows = await db
    .select({
      id: feedingSchedules.id,
      householdId: feedingSchedules.householdId,
      time: feedingSchedules.time,
      notifyAtTime: feedingSchedules.notifyAtTime,
      remindIfNotRecorded: feedingSchedules.remindIfNotRecorded,
    })
    .from(feedingSchedules);
  const byHousehold = new Map<string, FeedingScheduleForRule[]>();
  for (const { householdId, ...schedule } of rows) {
    const schedules = byHousehold.get(householdId) ?? [];
    schedules.push(schedule);
    byHousehold.set(householdId, schedules);
  }
  return byHousehold;
}

/**
 * 猫 id ごとの、直近のごはん記録の発生日時（naive UTC）。ごはんの時間の前後に記録があるかの
 * 判定に使う。ごはんの時間を登録した家の猫の記録だけを、全猫分まとめて 1 回のクエリで取得する。
 * `cats` との JOIN にすると、結合順によっては `feeding_records` 側が外側のループになり、
 * インデックス全体を走査してから期間で絞ることがある。猫 id を `cat_id IN (...)` で直接
 * 与え、`feeding_records_cat_id_occurred_at_idx` を猫ごとに期間で範囲検索させる
 */
async function listRecentFeedingAtsByCat(
  db: ReturnType<typeof getDb>,
  now: Date,
): Promise<Map<string, Date[]>> {
  const since = new Date(
    getNaiveLocalNow(now, NOTIFY_TIMEZONE).getTime() -
      FEEDING_RECORD_LOOKBACK_MS,
  );
  const rows = await db
    .select({
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
    })
    .from(feedingRecords)
    .where(
      and(
        inArray(
          feedingRecords.catId,
          db
            .select({ id: cats.id })
            .from(cats)
            .where(
              inArray(
                cats.householdId,
                db
                  .select({ householdId: feedingSchedules.householdId })
                  .from(feedingSchedules),
              ),
            ),
        ),
        gte(feedingRecords.occurredAt, since),
      ),
    );
  const byCat = new Map<string, Date[]>();
  for (const { catId, occurredAt } of rows) {
    const feedingAts = byCat.get(catId) ?? [];
    feedingAts.push(occurredAt);
    byCat.set(catId, feedingAts);
  }
  return byCat;
}

/**
 * 家についての通知（ごはんの時間）を、条件をもう一度確かめたうえで INSERT する。
 * 記録を読んでから INSERT するまでの間に、別のリクエストでごはんが記録されたり、ごはんの時間が
 * 削除・オフにされたりすることがある。そのまま INSERT すると、もう不要な通知が残って Push まで
 * 送られてしまう。家の最後の猫が削除・引っ越しされた場合も、その片付け（
 * `dismissFeedingNotificationsOfCatlessHouseholds`）の後に INSERT されると通知が残ってしまう。
 * ごはんの時間がまだ有効で、家に猫がいて、範囲内に家の猫のごはん記録がないことの確認と INSERT を
 * 1 つの `INSERT ... SELECT` にし、両者の間に更新が割り込まないようにする。
 * 記録は判定した時刻（スケジュール実行の予定時刻）ではなく、INSERT する時点（`now`）までのものを
 * 数える。ステップが遅れたり再試行されたりして判定した時刻より後に記録された場合も、その記録の
 * 保存時にはまだ通知がなく完了にできないため、ここで作らないようにする。
 * INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値をテーブル定義の
 * 順に明示する（`insertSymptomOngoingNotification` と同じ方式）
 */
export async function insertHouseholdNotification(
  db: ReturnType<typeof getDb>,
  candidate: HouseholdNotificationCandidate,
  message: NotificationMessage,
  now: Date = new Date(),
) {
  const recordedUntil = new Date(
    Math.min(
      candidate.recordWindow.end.getTime(),
      feedingRecordedUntil(getNaiveLocalNow(now, NOTIFY_TIMEZONE)).getTime(),
    ),
  );
  const enabledColumn =
    candidate.kind === "feeding_time"
      ? feedingSchedules.notifyAtTime
      : feedingSchedules.remindIfNotRecorded;
  await db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          catId: sql`null`.as("catId"),
          householdId: feedingSchedules.householdId,
          kind: sql`${candidate.kind}`.as("kind"),
          referenceId: feedingSchedules.id,
          dedupeKey: sql`${candidate.dedupeKey}`.as("dedupeKey"),
          title: sql`${message.title}`.as("title"),
          body: sql`${message.body}`.as("body"),
          url: sql`${message.url}`.as("url"),
          dueAt: sql`${sql.param(candidate.dueAt, notifications.dueAt)}`.as(
            "dueAt",
          ),
          status: sql`'pending'`.as("status"),
          snoozedUntil: sql`null`.as("snoozedUntil"),
          readAt: sql`null`.as("readAt"),
          pushedAt: sql`null`.as("pushedAt"),
          createdAt: sql`(unixepoch())`.as("createdAt"),
          updatedAt: sql`(unixepoch())`.as("updatedAt"),
        })
        .from(feedingSchedules)
        .where(
          and(
            eq(feedingSchedules.id, candidate.referenceId),
            eq(feedingSchedules.householdId, candidate.householdId),
            eq(enabledColumn, true),
            exists(
              db
                .select({ exists: sql`1` })
                .from(cats)
                .where(eq(cats.householdId, candidate.householdId)),
            ),
            notExists(
              db
                // 存在だけを見るので、インデックスにない列を選ばずに索引だけで判定させる
                .select({ exists: sql`1` })
                .from(feedingRecords)
                .where(
                  and(
                    // JOIN ではなく猫 id で絞り、インデックスを猫ごとに範囲検索させる
                    // （`listRecentFeedingAtsByCat` と同じ理由）
                    inArray(
                      feedingRecords.catId,
                      db
                        .select({ id: cats.id })
                        .from(cats)
                        .where(eq(cats.householdId, candidate.householdId)),
                    ),
                    gte(
                      feedingRecords.occurredAt,
                      candidate.recordWindow.start,
                    ),
                    lt(feedingRecords.occurredAt, recordedUntil),
                  ),
                ),
            ),
          ),
        ),
    )
    .onConflictDoNothing({ target: notifications.dedupeKey });
}

/**
 * 全猫の未解消（`ongoing`・`improving`）の症状記録を、その症状に対する `symptom_ongoing` 通知の
 * 対応状況とあわせて、猫 id ごとにまとめて返す（`evaluateSymptomOngoing` の入力）。
 * 猫ごとのループ内で問い合わせるとクエリ数が猫の数に比例して増えるため、全猫分を
 * 2 回のクエリでまとめて取得する
 */
async function listOpenSymptomsByCat(
  db: ReturnType<typeof getDb>,
): Promise<Map<string, OpenSymptom[]>> {
  const byCat = new Map<string, OpenSymptom[]>();
  const rows = await db
    .select({
      id: symptoms.id,
      catId: symptoms.catId,
      symptomType: symptoms.symptomType,
      onsetAt: symptoms.onsetAt,
      status: symptoms.status,
    })
    .from(symptoms)
    .where(ne(symptoms.status, "resolved"));
  if (rows.length === 0) {
    return byCat;
  }

  const symptomNotifications = await db
    .select({
      referenceId: notifications.referenceId,
      status: notifications.status,
      updatedAt: notifications.updatedAt,
    })
    .from(notifications)
    .where(eq(notifications.kind, "symptom_ongoing"));

  for (const row of rows) {
    // SQL で除外済みだが、型を `ongoing`・`improving` に絞り込むために判定する
    if (row.status === "resolved") {
      continue;
    }
    const related = symptomNotifications.filter(
      (notification) => notification.referenceId === row.id,
    );
    // 延期中（`snoozed`）の通知も、期日前かどうかに関わらず未対応として扱う
    const hasOpenNotification = related.some(
      (notification) =>
        notification.status === "pending" || notification.status === "snoozed",
    );
    const answeredTimes = related
      .filter(
        (notification) =>
          notification.status === "done" || notification.status === "dismissed",
      )
      .map((notification) => notification.updatedAt.getTime());
    const symptomsOfCat = byCat.get(row.catId) ?? [];
    symptomsOfCat.push({
      id: row.id,
      symptomType: row.symptomType,
      onsetAt: row.onsetAt,
      status: row.status,
      hasOpenNotification,
      lastAnsweredAt:
        answeredTimes.length > 0 ? new Date(Math.max(...answeredTimes)) : null,
    });
    byCat.set(row.catId, symptomsOfCat);
  }
  return byCat;
}

/**
 * 症状の確認通知を、対象の症状がまだ存在し未解消である場合に限って INSERT する。
 * `listOpenSymptomsByCat` で読んでからここで INSERT するまでの間に、別のリクエストで症状が
 * 解消・削除されることがある。`notifications.reference_id` には外部キーがないため、そのまま
 * INSERT すると解消済み・存在しない症状への通知が残ってしまう。症状の再確認と INSERT を
 * 1 つの `INSERT ... SELECT` にすることで、両者の間に更新が割り込まないようにする。
 * INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値を
 * テーブル定義の順に明示する（`markCleaningNotificationDoneAction` と同じ方式）
 */
export async function insertSymptomOngoingNotification(
  db: ReturnType<typeof getDb>,
  candidate: SymptomOngoingCandidate,
  message: NotificationMessage,
) {
  await db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          catId: symptoms.catId,
          householdId: sql`null`.as("householdId"),
          kind: sql`${candidate.kind}`.as("kind"),
          referenceId: symptoms.id,
          dedupeKey: sql`${candidate.dedupeKey}`.as("dedupeKey"),
          title: sql`${message.title}`.as("title"),
          body: sql`${message.body}`.as("body"),
          url: sql`${message.url}`.as("url"),
          dueAt: sql`${sql.param(candidate.dueAt, notifications.dueAt)}`.as(
            "dueAt",
          ),
          status: sql`'pending'`.as("status"),
          snoozedUntil: sql`null`.as("snoozedUntil"),
          readAt: sql`null`.as("readAt"),
          pushedAt: sql`null`.as("pushedAt"),
          createdAt: sql`(unixepoch())`.as("createdAt"),
          updatedAt: sql`(unixepoch())`.as("updatedAt"),
        })
        .from(symptoms)
        .where(
          and(
            eq(symptoms.id, candidate.symptomId),
            eq(symptoms.catId, candidate.catId),
            ne(symptoms.status, "resolved"),
          ),
        ),
    )
    .onConflictDoNothing({ target: notifications.dedupeKey });
}

/**
 * 全猫について通知判定を行い、まだ生成していない候補（`dedupe_key` が未登録のもの）だけを
 * `notifications` に INSERT する。`29`（スケジュール実行）と `30`（通知センター表示）の
 * 両方から呼ばれる想定で、同じ `now` に対して何度呼んでも重複して生成されない。
 * 通知時刻を過ぎたかどうかの判定は通知の種類ごとに異なるため、`evaluateNotificationRules`
 * に任せる（掃除の通知は対象ごとに通知時刻を指定できる）。
 *
 * `d1` は Cloudflare Workflows のステップ内（`src/workflows/notification.ts`）のように
 * リクエストの外から呼ぶ場合に渡す（`src/db/client.ts` の `getDb` 参照）
 */
export async function generateNotifications(
  now: Date,
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  const cats = await listAllCats(d1);
  const openSymptomsByCat = await listOpenSymptomsByCat(db);

  for (const cat of cats) {
    const [latestShampoo] = await db
      .select({ performedAt: shampooRecords.performedAt })
      .from(shampooRecords)
      .where(eq(shampooRecords.catId, cat.id))
      .orderBy(desc(shampooRecords.performedAt))
      .limit(1);

    const [latestWeight] = await db
      .select({ occurredAt: weightRecords.occurredAt })
      .from(weightRecords)
      .where(eq(weightRecords.catId, cat.id))
      .orderBy(desc(weightRecords.occurredAt))
      .limit(1);

    const cleaningTargets = await listCleaningTargetsWithStatus(
      cat.id,
      now,
      d1,
    );
    const settings = await getResolvedSettingsForCat(
      cat.id,
      cleaningTargets.map(({ target }) => target.id),
      d1,
    );

    const candidates = evaluateNotificationRules({
      now,
      timezone: NOTIFY_TIMEZONE,
      cat,
      settings,
      latestShampooAt: latestShampoo?.performedAt ?? null,
      latestWeightAt: latestWeight?.occurredAt ?? null,
      cleaningTargets,
      openSymptoms: openSymptomsByCat.get(cat.id) ?? [],
    });

    for (const candidate of candidates) {
      const message = buildNotificationMessage(cat.name, candidate);
      if (candidate.kind === "symptom_ongoing") {
        await insertSymptomOngoingNotification(db, candidate, message);
        continue;
      }
      await db
        .insert(notifications)
        .values({
          catId: candidate.catId,
          kind: candidate.kind,
          referenceId: candidate.referenceId,
          dedupeKey: candidate.dedupeKey,
          title: message.title,
          body: message.body,
          url: message.url,
          dueAt: candidate.dueAt,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey });
    }
  }

  await generateHouseholdNotifications(db, now, cats);
}

/**
 * 家についての通知（ごはんの時間）を判定し、まだ生成していない候補だけを INSERT する。
 * 猫のいない家には出さない。ごはん記録は猫ごとのため、家の猫すべての記録をまとめて判定に使う
 */
async function generateHouseholdNotifications(
  db: ReturnType<typeof getDb>,
  now: Date,
  cats: { id: string; householdId: string | null }[],
): Promise<void> {
  const schedulesByHousehold = await listFeedingSchedulesByHousehold(db);
  if (schedulesByHousehold.size === 0) {
    return;
  }
  const recentFeedingAtsByCat = await listRecentFeedingAtsByCat(db, now);

  for (const [householdId, schedules] of schedulesByHousehold) {
    const catIds = cats
      .filter((cat) => cat.householdId === householdId)
      .map((cat) => cat.id);
    if (catIds.length === 0) {
      continue;
    }

    const candidates = evaluateFeedingSchedule(
      householdId,
      now,
      NOTIFY_TIMEZONE,
      schedules,
      catIds.flatMap((catId) => recentFeedingAtsByCat.get(catId) ?? []),
    );
    for (const candidate of candidates) {
      const message = buildHouseholdNotificationMessage(candidate);
      await insertHouseholdNotification(db, candidate, message);
    }
  }
}
