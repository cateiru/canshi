import { and, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notificationSettings, notifications } from "@/db/schema";
import {
  DEFAULT_SHAMPOO_ELAPSED_MONTHS,
  DEFAULT_WEIGHT_MEASUREMENT_DAYS,
} from "./defaults";
import type { ResolvedNotificationSettings } from "./rules";

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

/** 対応済み（`done`・`dismissed`）の通知一覧。直近に対応したものから並べる */
export async function listResolvedNotifications(
  catId?: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const conditions = [
    inArray(notifications.status, ["done", "dismissed"] as const),
  ];
  if (catId) {
    conditions.push(eq(notifications.catId, catId));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.updatedAt));
}

/**
 * 未読（`read_at` が NULL）の未対応通知の件数。ヘッダーのバッジ（`NotificationBadge`）が使う
 */
export async function countUnreadNotifications(
  now: Date,
  d1?: D1Database,
): Promise<number> {
  const db = getDb(d1);
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        isNull(notifications.readAt),
        or(
          eq(notifications.status, "pending"),
          and(
            eq(notifications.status, "snoozed"),
            lte(notifications.snoozedUntil, now),
          ),
        ),
      ),
    );
  return rows.length;
}
