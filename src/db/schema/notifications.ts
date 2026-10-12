import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { households } from "./households";
import { NOTIFICATION_KINDS } from "./notification-kinds";

/**
 * 生成された通知。猫についての通知は `cat_id`、家についての通知（猫を問わないもの）は
 * `household_id` を持ち、どちらか一方だけを必ず持つ（`notifications_target_check`）。
 * `cat_id` を持つが記録テーブルではなく、タイムライン（`14`）の対象外（`src/db/README.md` 参照）。`dedupe_key` の UNIQUE 制約により、同じ判定結果からの
 * 二重生成を防ぐ（`src/features/notifications/generate.ts` が `onConflictDoNothing` で insert する）
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // 猫についての通知の猫。家についての通知では null
    catId: text("cat_id").references(() => cats.id),
    // 家についての通知の家。猫についての通知では null（猫の家は `cats.household_id` から引く）
    householdId: text("household_id").references(() => households.id),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    // cleaning_due の場合は cleaning_targets.id、symptom_ongoing の場合は symptoms.id を持つ。
    // それ以外は null
    referenceId: text("reference_id"),
    dedupeKey: text("dedupe_key").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    status: text("status", {
      enum: ["pending", "done", "snoozed", "dismissed"],
    })
      .notNull()
      .default("pending"),
    snoozedUntil: integer("snoozed_until", { mode: "timestamp" }),
    readAt: integer("read_at", { mode: "timestamp" }),
    // Web Push で送信済みになった日時（`29` で使用）
    pushedAt: integer("pushed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("notifications_status_due_at_idx").on(table.status, table.dueAt),
    // 列を表名で修飾すると、マイグレーションで作り直すときの一時的な表名が制約に残るため、
    // 修飾しない列名で書く
    check(
      "notifications_target_check",
      sql`(cat_id IS NULL) <> (household_id IS NULL)`,
    ),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationStatus = Notification["status"];
