import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * 猫を飼っている「家」。1 名以上のユーザー（household_members）と複数の猫
 * （cats.household_id）を紐付ける。オーナーは常に 1 名で、`owner_user_id` を
 * 書き換えることで別のメンバーへ移譲できる
 */
export const households = sqliteTable("households", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // オーナーは household_members にもメンバーとして登録しておく
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
