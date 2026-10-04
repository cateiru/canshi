import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";
import { users } from "./users";

/** 家とユーザーの多対多の紐付け。オーナー（households.owner_user_id）もここに含める */
export const householdMembers = sqliteTable(
  "household_members",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.userId] }),
    index("household_members_user_id_idx").on(table.userId),
  ],
);

export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;
