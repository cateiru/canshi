import { listAllCats } from "@/features/cats/infrastructure/queries";
import { listCleaningTargetsWithStatus } from "@/features/cleaning/infrastructure/targetQueries";
import { NOTIFY_TIMEZONE } from "../domain/defaults";
import {
  buildHouseholdNotificationMessage,
  buildNotificationMessage,
} from "../domain/messages";
import type { NotificationGenerationRepository } from "../domain/notificationGenerationRepository";
import { evaluateNotificationRules } from "../domain/rules";
import { evaluateFeedingSchedule } from "../domain/rules/feedingSchedule";
import { createNotificationGenerationRepository } from "../infrastructure/notificationGenerationRepository";
import { getResolvedSettingsForCat } from "../infrastructure/queries";

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
  const repository = createNotificationGenerationRepository(d1);
  const cats = await listAllCats(d1);
  const openSymptomsByCat = await repository.listOpenSymptomsByCat();

  for (const cat of cats) {
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
      latestShampooAt: await repository.findLatestShampooAt(cat.id),
      latestWeightAt: await repository.findLatestWeightAt(cat.id),
      cleaningTargets,
      openSymptoms: openSymptomsByCat.get(cat.id) ?? [],
    });

    for (const candidate of candidates) {
      const message = buildNotificationMessage(cat.name, candidate);
      if (candidate.kind === "symptom_ongoing") {
        await repository.insertSymptomOngoingNotification(candidate, message);
        continue;
      }
      await repository.insertCatNotification(candidate, message);
    }
  }

  await generateHouseholdNotifications(repository, now, cats);
}

/**
 * 家についての通知（ごはんの時間）を判定し、まだ生成していない候補だけを書く。
 * 猫のいない家には出さない。ごはん記録は猫ごとのため、家の猫すべての記録をまとめて判定に使う
 */
async function generateHouseholdNotifications(
  repository: NotificationGenerationRepository,
  now: Date,
  cats: { id: string; householdId: string | null }[],
): Promise<void> {
  const schedulesByHousehold =
    await repository.listFeedingSchedulesByHousehold();
  if (schedulesByHousehold.size === 0) {
    return;
  }
  const recentFeedingAtsByCat = await repository.listRecentFeedingAtsByCat(now);

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
      await repository.insertHouseholdNotification(candidate, message);
    }
  }
}
