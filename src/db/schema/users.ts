import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * アプリの利用者。現時点では認証を持たず、`/login` のログインボタンで
 * 先頭のユーザーを使う（いなければ作る）ため、常に 1 件以上存在する前提
 * （`src/features/auth/users.ts`）
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // アプリ全体の権限。家の中での権限（household_members.role）とは別
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
