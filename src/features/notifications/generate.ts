import { desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notifications,
  shampooRecords,
  symptoms,
  weightRecords,
} from "@/db/schema";
import { listCats } from "@/features/cats/queries";
import { listCleaningTargetsWithStatus } from "@/features/cleaning/targetQueries";
import { NOTIFY_TIMEZONE } from "./defaults";
import { buildNotificationMessage } from "./messages";
import { getResolvedSettingsForCat } from "./queries";
import { evaluateNotificationRules, type OpenSymptom } from "./rules";

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
  const cats = await listCats(d1);
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
}
