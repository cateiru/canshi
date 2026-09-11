import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 通知時刻・タイムゾーンの全体設定。アプリ全体で常に 1 行（id 固定値 "default"）だけ扱う。
 * 行が存在しない場合は `getNotificationPreferences`（`src/features/notifications/queries.ts`）
 * が既定値（09:00・Asia/Tokyo）を返す
 */
export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey().default("default"),
  // HH:MM 形式
  notifyTime: text("notify_time").notNull().default("09:00"),
  // IANA タイムゾーン名
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences =
  typeof notificationPreferences.$inferInsert;
