import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cats = sqliteTable("cats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  sex: text("sex", { enum: ["male", "female", "unknown"] }).notNull(),
  // 生年月日・お迎え日は時刻を持たないため ISO8601 の日付文字列（YYYY-MM-DD）で保持する
  birthDate: text("birth_date"),
  breed: text("breed"),
  adoptedAt: text("adopted_at"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Cat = typeof cats.$inferSelect;
export type NewCat = typeof cats.$inferInsert;
