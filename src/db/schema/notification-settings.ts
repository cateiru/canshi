import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { NOTIFICATION_KINDS } from "./notification-kinds";

/**
 * 猫ごと・種類ごとの通知の有効／無効とパラメータ。
 * 行が無い組み合わせは既定値（すべて有効、シャンプー2ヶ月、体重測定14日）として扱う
 * （`src/features/notifications/queries.ts` の `getResolvedSettingsForCat` 参照）
 */
export const notificationSettings = sqliteTable(
  "notification_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    // cleaning_due の場合のみ cleaning_targets.id を持つ。それ以外は null
    referenceId: text("reference_id"),
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    // シャンプー経過月数・体重測定日数など、種類ごとのパラメータ
    params: text("params", { mode: "json" }).$type<{
      months?: number;
      days?: number;
    }>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // SQLite の UNIQUE 制約は NULL 同士を同値と扱わないため、reference_id が NULL の行は
    // (cat_id, kind, reference_id) の UNIQUE だけでは重複を防げない。NULL 用と非 NULL 用の
    // 部分 UNIQUE インデックスに分ける
    uniqueIndex("notification_settings_cat_kind_null_reference_unique")
      .on(table.catId, table.kind)
      .where(sql`${table.referenceId} IS NULL`),
    uniqueIndex("notification_settings_cat_kind_reference_unique")
      .on(table.catId, table.kind, table.referenceId)
      .where(sql`${table.referenceId} IS NOT NULL`),
  ],
);

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type NewNotificationSettings = typeof notificationSettings.$inferInsert;
export type NotificationKind = NotificationSettings["kind"];
