import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  householdInvitations,
  householdMembers,
  households,
  users,
} from "@/db/schema";
import type { HouseholdInvitationRepository } from "../domain/householdInvitationRepository";
import { isOwnerCondition } from "./householdRepository";

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

/** D1 に保存する `HouseholdInvitationRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createHouseholdInvitationRepository(
  d1?: D1Database,
): HouseholdInvitationRepository {
  const db = getDb(d1);
  return {
    async removeExpired(householdId, now) {
      await db
        .delete(householdInvitations)
        .where(
          and(
            eq(householdInvitations.householdId, householdId),
            isNull(householdInvitations.acceptedByUserId),
            lte(householdInvitations.expiresAt, now),
          ),
        );
    },

    async addAsOwner(householdId, ownerUserId, tokenHash, expiresAt, now) {
      // オーナーかどうかの判定を INSERT に含め、移譲と同時に発行されても元のオーナーの
      // 発行が通らないようにする（`isOwnerCondition` と同じ考え方）
      const inserted = await db
        .insert(householdInvitations)
        .select(
          db
            .select({
              id: sql`${crypto.randomUUID()}`.as("id"),
              householdId: sql`${householdId}`.as("household_id"),
              tokenHash: sql`${tokenHash}`.as("token_hash"),
              createdByUserId: sql`${ownerUserId}`.as("created_by_user_id"),
              expiresAt: sql`${toUnixSeconds(expiresAt)}`.as("expires_at"),
              acceptedByUserId: sql`NULL`.as("accepted_by_user_id"),
              acceptedAt: sql`NULL`.as("accepted_at"),
              acceptanceId: sql`NULL`.as("acceptance_id"),
              createdAt: sql`${toUnixSeconds(now)}`.as("created_at"),
            })
            .from(households)
            .where(
              and(
                eq(households.id, householdId),
                isOwnerCondition(householdId, ownerUserId),
              ),
            ),
        )
        .returning({ id: householdInvitations.id });
      return inserted.length > 0;
    },

    async removeAsOwner(householdId, ownerUserId, invitationId) {
      const deleted = await db
        .delete(householdInvitations)
        .where(
          and(
            eq(householdInvitations.id, invitationId),
            eq(householdInvitations.householdId, householdId),
            isNull(householdInvitations.acceptedByUserId),
            isOwnerCondition(householdId, ownerUserId),
          ),
        )
        .returning({ id: householdInvitations.id });
      return deleted.length > 0;
    },

    async findForUser(tokenHash, userId) {
      const [row] = await db
        .select({
          householdId: households.id,
          householdName: households.name,
          createdByName: users.name,
          expiresAt: householdInvitations.expiresAt,
          acceptedByUserId: householdInvitations.acceptedByUserId,
          isMember: sql<number>`EXISTS (
            SELECT 1 FROM ${householdMembers} AS m
            WHERE m.household_id = ${households.id}
              AND m.user_id = ${userId}
          )`,
        })
        .from(householdInvitations)
        .innerJoin(
          households,
          eq(householdInvitations.householdId, households.id),
        )
        .innerJoin(users, eq(householdInvitations.createdByUserId, users.id))
        .where(eq(householdInvitations.tokenHash, tokenHash))
        .limit(1);
      return row ? { ...row, isMember: Boolean(row.isMember) } : null;
    },

    async accept(tokenHash, userId, now) {
      // 招待を「使用済み」にする UPDATE と、メンバーに加える INSERT を 1 つの batch
      // （トランザクション）で実行し、どちらか一方だけが反映された状態を作らない。
      // UPDATE の WHERE に未使用であることを含めているため、同時に別のユーザーが参加しようと
      // しても使用済みにできるのは 1 人だけ。UPDATE はこの処理ごとに発行した ID
      // （`acceptance_id`）を招待に書き込み、INSERT はその ID の招待からだけメンバーを作る
      const acceptanceId = crypto.randomUUID();
      const [claimed] = await db.batch([
        db
          .update(householdInvitations)
          .set({ acceptedByUserId: userId, acceptedAt: now, acceptanceId })
          .where(
            and(
              eq(householdInvitations.tokenHash, tokenHash),
              isNull(householdInvitations.acceptedByUserId),
              gt(householdInvitations.expiresAt, now),
              sql`NOT EXISTS (
                SELECT 1 FROM ${householdMembers} AS m
                WHERE m.household_id = ${householdInvitations.householdId}
                  AND m.user_id = ${userId}
              )`,
            ),
          )
          .returning({ householdId: householdInvitations.householdId }),
        db.insert(householdMembers).select(
          db
            .select({
              householdId: householdInvitations.householdId,
              userId: sql`${userId}`.as("user_id"),
              role: sql`'member'`.as("role"),
              createdAt: sql`${toUnixSeconds(now)}`.as("created_at"),
            })
            .from(householdInvitations)
            .where(eq(householdInvitations.acceptanceId, acceptanceId)),
        ),
      ]);
      return claimed[0]?.householdId ?? null;
    },
  };
}
