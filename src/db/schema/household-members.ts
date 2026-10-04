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

/**
 * 家とユーザーの多対多の紐付け。`role` が家の中での権限で、オーナー（`owner`）は
 * 家ごとに 1 名以上いる。今はオーナーを 1 名で運用している（移譲は
 * `src/features/households/ownership.ts`）が、複数のオーナーも持てる
 */
export const householdMembers = sqliteTable(
  "household_members",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
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
