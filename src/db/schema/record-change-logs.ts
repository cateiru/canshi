import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/** 操作を記録する記録テーブル。識別子は `media_assets.record_type` と同じ単数形にする */
export const RECORD_CHANGE_LOG_RECORD_TYPES = [
  "feeding_record",
  "poop_record",
  "weight_record",
  "vomit_record",
  "water_record",
  "shampoo_record",
  "brushing_record",
  "cleaning_record",
  "symptom",
  "medication",
  "medication_dose",
  "hospital_visit",
  "memo_record",
  "expense",
] as const;

export type RecordChangeLogRecordType =
  (typeof RECORD_CHANGE_LOG_RECORD_TYPES)[number];

export const RECORD_CHANGE_LOG_ACTIONS = [
  "create",
  "update",
  "delete",
] as const;

export type RecordChangeLogAction = (typeof RECORD_CHANGE_LOG_ACTIONS)[number];

/**
 * 記録を操作した人。AI との接続（MCP）からの操作では、接続を許可したユーザーと、
 * 接続（OAuth のクライアントの ID）を両方持つ。画面からの操作では `mcpClientId` は null
 */
export type RecordActor = {
  userId: string;
  mcpClientId: string | null;
};

/**
 * 記録の作成・編集・削除の履歴。保存した人と日時を残すためのもので、今は画面にも AI にも返さない。
 * 1 回の保存につき 1 行で、記録の書き込みと同じ batch で追加する（`src/db/recordChangeLog.ts`）。
 *
 * - 記録のテーブルが複数あるため、`record_type` と `record_id` で指し、外部キーにはしない
 * - `user_id` は外部キーで、ユーザーを物理削除すると履歴を残せないため、ユーザーの物理削除を防ぐ
 * - `mcp_client_id` の接続は `oauth_kv_entries` にあるため外部キーにせず、接続を解除しても残す
 */
export const recordChangeLogs = sqliteTable(
  "record_change_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recordType: text("record_type", {
      enum: RECORD_CHANGE_LOG_RECORD_TYPES,
    }).notNull(),
    recordId: text("record_id").notNull(),
    action: text("action", { enum: RECORD_CHANGE_LOG_ACTIONS }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    mcpClientId: text("mcp_client_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 記録ごとの履歴を読むため。猫を削除するときに、その猫の記録の履歴を消すためにも使う
    index("record_change_logs_record_idx").on(table.recordType, table.recordId),
  ],
);

export type RecordChangeLog = typeof recordChangeLogs.$inferSelect;
export type NewRecordChangeLog = typeof recordChangeLogs.$inferInsert;
