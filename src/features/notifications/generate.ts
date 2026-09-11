import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications, shampooRecords, weightRecords } from "@/db/schema";
import { listCats } from "@/features/cats/queries";
import { listCleaningTargetsWithStatus } from "@/features/cleaning/targetQueries";
import { buildNotificationMessage } from "./messages";
import {
  getNotificationPreferences,
  getResolvedSettingsForCat,
} from "./queries";
import { evaluateNotificationRules } from "./rules";
import { getLocalTimeString } from "./rules/localDate";

/**
 * 全猫について通知判定を行い、まだ生成していない候補（`dedupe_key` が未登録のもの）だけを
 * `notifications` に INSERT する。`29`（スケジュール実行）と `30`（通知センター表示）の
 * 両方から呼ばれる想定で、同じ `now` に対して何度呼んでも重複して生成されない
 */
export async function generateNotifications(now: Date): Promise<void> {
  const db = getDb();
  const preferences = await getNotificationPreferences();

  // 通知時刻を過ぎるまでは生成しない
  if (getLocalTimeString(now, preferences.timezone) < preferences.notifyTime) {
    return;
  }

  const cats = await listCats();

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

    const cleaningTargets = await listCleaningTargetsWithStatus(cat.id, now);
    const settings = await getResolvedSettingsForCat(
      cat.id,
      cleaningTargets.map(({ target }) => target.id),
    );

    const candidates = evaluateNotificationRules({
      now,
      timezone: preferences.timezone,
      cat,
      settings,
      latestShampooAt: latestShampoo?.performedAt ?? null,
      latestWeightAt: latestWeight?.occurredAt ?? null,
      cleaningTargets,
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
