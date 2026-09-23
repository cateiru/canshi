import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 通知時刻・タイムゾーンの全体設定（旧）。通知時刻は 18:00（日本時間）固定になり
 * （`src/features/notifications/defaults.ts`）、このテーブルはどこからも読み書きしない。
 * デプロイ前後で古いコードから参照されうるため、テーブルの削除は後続の PR で行う
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
