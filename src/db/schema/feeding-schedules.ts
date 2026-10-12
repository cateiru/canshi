import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";

/**
 * 家ごとの「ごはんの時間」。その家の猫について、時間になったときの通知と、時間の前後に
 * ごはん記録がないときのリマインダーを出す（`src/features/notifications/rules/feedingSchedule.ts`）
 */
export const feedingSchedules = sqliteTable(
  "feeding_schedules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    // ごはんの時刻（HH:MM、15分刻み）。日本時間の時計の時刻として扱う
    time: text("time").notNull(),
    // 時間になったときに「ごはんの時間です」の通知を出すか
    notifyAtTime: integer("notify_at_time", { mode: "boolean" })
      .notNull()
      .default(true),
    // 時間の前後にごはん記録がないとき、次のごはんの時間との中間で確認の通知を出すか
    remindIfNotRecorded: integer("remind_if_not_recorded", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("feeding_schedules_household_id_time_unique").on(
      table.householdId,
      table.time,
    ),
  ],
);

export type FeedingSchedule = typeof feedingSchedules.$inferSelect;
export type NewFeedingSchedule = typeof feedingSchedules.$inferInsert;
