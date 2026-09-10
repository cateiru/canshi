import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

/**
 * 画像・動画を一元管理する正規化テーブル。
 * `recordType` + `recordId` の polymorphic な組で対象レコード（うんち・嘔吐・症状・服薬・通院・ごはん商品など）に紐付ける。
 * 元データとサムネイルは R2 に保存し、このテーブルにはオブジェクトキーとメタ情報のみ持つ（詳細は src/db/README.md を参照）。
 */
export const mediaAssets = sqliteTable(
  "media_assets",
  {
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
    // 元データのサイズ。保存容量の上限判定は size_bytes + thumbnail_size_bytes の SUM で行う
    sizeBytes: integer("size_bytes").notNull().default(0),
    thumbnailSizeBytes: integer("thumbnail_size_bytes"),
    // 画像本体、または動画サムネイルの寸法。一覧のレイアウト計算（アスペクト比）に使う
    width: integer("width"),
    height: integer("height"),
    // 同一レコード内での表示順
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("media_assets_record_idx").on(table.recordType, table.recordId),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
