import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

/**
 * 愛猫の体の写真の記録。写真本体は media_assets（record_type = "cat_photo"）に複数枚紐付ける
 */
export const catPhotos = sqliteTable("cat_photos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  takenAt: integer("taken_at", { mode: "timestamp" }).notNull(),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type CatPhoto = typeof catPhotos.$inferSelect;
export type NewCatPhoto = typeof catPhotos.$inferInsert;
