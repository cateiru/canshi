import { and, desc, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notificationPreferences,
  notificationSettings,
  notifications,
} from "@/db/schema";
import {
  DEFAULT_NOTIFY_TIME,
  DEFAULT_SHAMPOO_ELAPSED_MONTHS,
  DEFAULT_TIMEZONE,
  DEFAULT_WEIGHT_MEASUREMENT_DAYS,
} from "./defaults";
import type { ResolvedNotificationSettings } from "./rules";

export type NotificationPreferencesValue = {
  notifyTime: string;
  timezone: string;
};

/** 行が無い場合は既定値（09:00・Asia/Tokyo）を返す */
export async function getNotificationPreferences(
  d1?: D1Database,
): Promise<NotificationPreferencesValue> {
  const db = getDb(d1);
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.id, "default"))
    .limit(1);

  return row ?? { notifyTime: DEFAULT_NOTIFY_TIME, timezone: DEFAULT_TIMEZONE };
}

/**
 * 猫ごとの通知設定を、`notification_settings` の行が無い種類・掃除対象について
 * 既定値で埋めて返す
 */
export async function getResolvedSettingsForCat(
  catId: string,
  cleaningTargetIds: string[],
  d1?: D1Database,
): Promise<ResolvedNotificationSettings> {
  const db = getDb(d1);
  const rows = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.catId, catId));

  const byKind = new Map<string, (typeof rows)[number]>();
  const byCleaningTarget = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (row.kind === "cleaning_due" && row.referenceId) {
      byCleaningTarget.set(row.referenceId, row);
    } else {
      byKind.set(row.kind, row);
    }
  }

  return {
    birthdayYearly: {
      isEnabled: byKind.get("birthday_yearly")?.isEnabled ?? true,
    },
    birthdayHalfYear: {
      isEnabled: byKind.get("birthday_half_year")?.isEnabled ?? true,
    },
    daysMilestone: {
      isEnabled: byKind.get("days_milestone")?.isEnabled ?? true,
    },
    shampooElapsed: {
      isEnabled: byKind.get("shampoo_elapsed")?.isEnabled ?? true,
      months:
        byKind.get("shampoo_elapsed")?.params?.months ??
        DEFAULT_SHAMPOO_ELAPSED_MONTHS,
    },
    weightMeasurement: {
      isEnabled: byKind.get("weight_measurement")?.isEnabled ?? true,
      days:
        byKind.get("weight_measurement")?.params?.days ??
        DEFAULT_WEIGHT_MEASUREMENT_DAYS,
    },
    cleaningDue: new Map(
      cleaningTargetIds.map((id) => [
        id,
        { isEnabled: byCleaningTarget.get(id)?.isEnabled ?? true },
      ]),
    ),
  };
}

/**
 * 未対応（`pending`、または `snoozed` で `snoozedUntil` が到来済み）の通知一覧。
 * `src/features/notifications/status.ts` の `isNotificationPending` と同じ判定を SQL で行う
 */
export async function listPendingNotifications(
  now: Date,
  catId?: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const conditions = [
    or(
      eq(notifications.status, "pending"),
      and(
        eq(notifications.status, "snoozed"),
        lte(notifications.snoozedUntil, now),
      ),
    ),
  ];
  if (catId) {
    conditions.push(eq(notifications.catId, catId));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.dueAt));
}
