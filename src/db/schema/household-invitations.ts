import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";
import { users } from "./users";

/**
 * 家への招待 URL。URL に含めるトークンそのものは保存せず、そのハッシュ（SHA-256）を持つ。
 * 1 つの招待で家に参加できるのは 1 人だけで、参加したユーザーを `accepted_by_user_id` に残す。
 * 無効化した招待は行を削除する（`src/features/households/invitations.ts`）
 */
export const householdInvitations = sqliteTable(
  "household_invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    // この日時を過ぎた招待では参加できない
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    // 招待で家に参加したユーザー。NULL のあいだは未使用
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    // 参加の処理ごとに発行する ID。招待を使用済みにする UPDATE と同じ batch の INSERT が、
    // その処理で使用済みにした招待からだけメンバーを作るための目印
    // （`src/features/households/invitations.ts` の `acceptHouseholdInvitation`）
    acceptanceId: text("acceptance_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("household_invitations_token_hash_idx").on(table.tokenHash),
    index("household_invitations_household_id_idx").on(table.householdId),
  ],
);

export type HouseholdInvitation = typeof householdInvitations.$inferSelect;
export type NewHouseholdInvitation = typeof householdInvitations.$inferInsert;
