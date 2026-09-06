import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./media-assets";

/**
 * AI 評価結果を一元管理する正規化テーブル。
 * `recordType` + `recordId` の polymorphic な組で対象レコードに紐付ける。
 * MVP では AI 評価の呼び出しを実装せず、テーブル定義のみ用意する（詳細は src/db/README.md を参照）。
 */
export const aiEvaluations = sqliteTable("ai_evaluations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  aiOutput: text("ai_output", { mode: "json" }).notNull(),
  evaluatedAt: integer("evaluated_at", { mode: "timestamp" }).notNull(),
  userCorrection: text("user_correction", { mode: "json" }),
  mediaAssetId: text("media_asset_id").references(() => mediaAssets.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type AiEvaluation = typeof aiEvaluations.$inferSelect;
export type NewAiEvaluation = typeof aiEvaluations.$inferInsert;
