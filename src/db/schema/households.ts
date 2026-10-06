import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 猫を飼っている「家」。1 名以上のユーザー（household_members）と複数の猫
 * （cats.household_id）を紐付ける。オーナーは household_members の `role` で持つ
 */
export const households = sqliteTable("households", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
