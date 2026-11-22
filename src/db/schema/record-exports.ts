import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";
import { users } from "./users";

/**
 * 記録の出力の状態。
 *
 * - `pending`: 依頼を受け付け、バッチの開始を待っている
 * - `processing`: バッチが zip を作っている
 * - `completed`: zip を作り終え、ダウンロードできる
 * - `failed`: zip を作れなかった
 */
export const RECORD_EXPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type RecordExportStatus = (typeof RECORD_EXPORT_STATUSES)[number];

/** 処理中として扱う状態。家ごとに 1 件だけにする（`record_exports_household_id_running_unique`） */
export const RUNNING_RECORD_EXPORT_STATUSES = [
  "pending",
  "processing",
] as const satisfies readonly RecordExportStatus[];

/**
 * 出力できなかった理由。
 *
 * - `too_large`: zip の大きさ・ファイル数が上限を超える
 * - `error`: それ以外（バッチの失敗・時間切れなど）
 */
export const RECORD_EXPORT_FAILURE_REASONS = ["too_large", "error"] as const;

export type RecordExportFailureReason =
  (typeof RECORD_EXPORT_FAILURE_REASONS)[number];

/**
 * 記録の出力（#286）。家の記録を CSV にして、写真・動画とあわせて zip にまとめたもの。
 * 家のメンバーが出力する記録の種類と写真・動画を含めるかを選ぶと、バッチ（Cloudflare Workflows の
 * `RecordExportWorkflow`）が zip を作って R2 に置き、家のメンバーなら誰でもダウンロードできる
 * （`src/features/record-exports`）。
 *
 * - 処理中の出力は家ごとに 1 件だけにする（部分一意インデックス）
 * - zip は R2 の `object_key` に置く。行を削除するときは R2 のオブジェクトも消す
 */
export const recordExports = sqliteTable(
  "record_exports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    // 出力を依頼したユーザー
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    // 出力する記録の種類（`RECORD_EXPORT_TYPES`）の JSON 配列。`RECORD_EXPORT_TYPES` の順に並べて保存する
    recordTypes: text("record_types", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    // 記録に添付した写真・動画を zip に含めるか
    includeMedia: integer("include_media", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: RECORD_EXPORT_STATUSES })
      .notNull()
      .default("pending"),
    // `failed` のときの理由。それ以外は NULL
    failureReason: text("failure_reason", {
      enum: RECORD_EXPORT_FAILURE_REASONS,
    }),
    // 作った zip の R2 のオブジェクトキーと大きさ。`completed` のときだけ持つ
    objectKey: text("object_key"),
    sizeBytes: integer("size_bytes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // `completed`・`failed` になった日時
    finishedAt: integer("finished_at", { mode: "timestamp" }),
  },
  (table) => [
    // 家ごとに新しい順に一覧するため
    index("record_exports_household_id_created_at_idx").on(
      table.householdId,
      table.createdAt,
    ),
    // 処理中の出力は家ごとに 1 件だけにする。同時に依頼されても、2 件目の INSERT は何もしない
    uniqueIndex("record_exports_household_id_running_unique")
      .on(table.householdId)
      .where(sql`status IN ('pending', 'processing')`),
  ],
);

export type RecordExport = typeof recordExports.$inferSelect;
export type NewRecordExport = typeof recordExports.$inferInsert;
