import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

/**
 * 画像・動画を一元管理する正規化テーブル。
 * `recordType` + `recordId` の polymorphic な組で対象レコード（うんち・体重・嘔吐・症状・服薬・通院など）に紐付ける。
 * MVP では書き込みロジックを実装せず、テーブル定義のみ用意する（詳細は src/db/README.md を参照）。
 */
export const mediaAssets = sqliteTable("media_assets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // ごはん商品画像など猫に紐付かないメディアを許容するため nullable
  catId: text("cat_id").references(() => cats.id),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  objectKey: text("object_key").notNull(),
  thumbnailObjectKey: text("thumbnail_object_key"),
  mimeType: text("mime_type").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
