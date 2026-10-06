import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  householdInvitations,
  householdMembers,
  households,
  users,
} from "@/db/schema";
import {
  generateSessionToken,
  hashSessionToken,
} from "@/features/auth/sessionToken";
import { isOwnerCondition } from "./management";

/** 招待 URL の有効期間。発行から延長しない */
export const HOUSEHOLD_INVITATION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** 招待 URL のパス。トークンは発行したときにしか分からないため、URL もそのときに組み立てる */
export function householdInvitationPath(token: string) {
  return `/invitations/${token}`;
}

export type CreateHouseholdInvitationResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * 家への招待を発行し、URL に含めるトークンを返す。家のオーナーだけが発行できる。
 * DB にはトークンのハッシュだけを保存するため、トークン（URL）を返せるのはこのときだけ。
 * ついでに、その家の期限切れで未使用の招待を削除する
 */
export async function createHouseholdInvitation(
  householdId: string,
  ownerUserId: string,
  d1?: D1Database,
): Promise<CreateHouseholdInvitationResult> {
  const db = getDb(d1);
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + HOUSEHOLD_INVITATION_MAX_AGE_SECONDS * 1000,
  );

  await db
    .delete(householdInvitations)
    .where(
      and(
        eq(householdInvitations.householdId, householdId),
        isNull(householdInvitations.acceptedByUserId),
        lte(householdInvitations.expiresAt, now),
      ),
    );

  // オーナーかどうかの判定を INSERT に含め、移譲と同時に発行されても元のオーナーの
  // 発行が通らないようにする（`management.ts` の `isOwnerCondition` と同じ考え方）
  const inserted = await db
    .insert(householdInvitations)
    .select(
      db
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          householdId: sql`${householdId}`.as("household_id"),
          tokenHash: sql`${await hashSessionToken(token)}`.as("token_hash"),
          createdByUserId: sql`${ownerUserId}`.as("created_by_user_id"),
          expiresAt: sql`${toUnixSeconds(expiresAt)}`.as("expires_at"),
          acceptedByUserId: sql`NULL`.as("accepted_by_user_id"),
          acceptedAt: sql`NULL`.as("accepted_at"),
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

  if (inserted.length === 0) {
    return { ok: false, error: "招待 URL を発行できるのはオーナーだけです" };
  }
  return { ok: true, token, expiresAt };
}

/** 家の招待のうち、まだ使われておらず期限内のものを新しい順に返す（家の設定の一覧に使う） */
export async function listPendingHouseholdInvitations(
  householdId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  return db
    .select({
      id: householdInvitations.id,
      createdByName: users.name,
      expiresAt: householdInvitations.expiresAt,
      createdAt: householdInvitations.createdAt,
    })
    .from(householdInvitations)
    .innerJoin(users, eq(householdInvitations.createdByUserId, users.id))
    .where(
      and(
        eq(householdInvitations.householdId, householdId),
        isNull(householdInvitations.acceptedByUserId),
        gt(householdInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(
      desc(householdInvitations.createdAt),
      desc(householdInvitations.id),
    );
}

export type RevokeHouseholdInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * まだ使われていない招待を無効化する（行を削除する）。家のオーナーだけが無効化でき、
 * 無効化した招待の URL を開いても家には参加できない
 */
export async function revokeHouseholdInvitation(
  householdId: string,
  ownerUserId: string,
  invitationId: string,
  d1?: D1Database,
): Promise<RevokeHouseholdInvitationResult> {
  const db = getDb(d1);
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

  if (deleted.length === 0) {
    return {
      ok: false,
      error:
        "招待を無効化できませんでした。オーナー本人が、まだ使われていない招待を選んでください",
    };
  }
  return { ok: true };
}

export type HouseholdInvitationPreview =
  /** 存在しない・期限切れ・使用済み・無効化済みの招待。どれなのかは区別しない */
  | { status: "invalid" }
  /** 開いたユーザーがすでにその家のメンバー */
  | { status: "member"; householdId: string; householdName: string }
  | {
      status: "valid";
      householdName: string;
      createdByName: string;
      expiresAt: Date;
    };

/** 招待 URL を開いたユーザーに、招待された家と参加できるかどうかを返す */
export async function getHouseholdInvitationPreview(
  token: string,
  userId: string,
  d1?: D1Database,
): Promise<HouseholdInvitationPreview> {
  const db = getDb(d1);
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
    .innerJoin(households, eq(householdInvitations.householdId, households.id))
    .innerJoin(users, eq(householdInvitations.createdByUserId, users.id))
    .where(eq(householdInvitations.tokenHash, await hashSessionToken(token)))
    .limit(1);

  if (!row) {
    return { status: "invalid" };
  }
  // 参加済みのユーザーがもう一度開いた場合も、使用済みではなく参加済みとして案内する
  if (row.isMember) {
    return {
      status: "member",
      householdId: row.householdId,
      householdName: row.householdName,
    };
  }
  if (row.acceptedByUserId !== null || row.expiresAt <= new Date()) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    householdName: row.householdName,
    createdByName: row.createdByName,
    expiresAt: row.expiresAt,
  };
}

export type AcceptHouseholdInvitationResult =
  | { ok: true; householdId: string }
  | { ok: false; error: string };

/**
 * 招待を使って家に参加する。1 つの招待で参加できるのは 1 人だけ。
 *
 * 招待を「使用済み」にする UPDATE と、メンバーに加える INSERT を 1 つの batch
 * （トランザクション）で実行し、どちらか一方だけが反映された状態を作らない。
 * UPDATE の WHERE に未使用であることを含めているため、同時に別のユーザーが参加しようと
 * しても使用済みにできるのは 1 人だけで、INSERT は「このリクエストで使用済みにした
 * 招待」（参加したユーザーと日時が一致する招待）からだけメンバーを作る。
 * すでにその家のメンバーであるユーザーが開いた場合は、使用済みにせずに失敗させる
 * （オーナーが自分で URL を試しても、招待した相手が参加できなくならないように）
 */
export async function acceptHouseholdInvitation(
  token: string,
  userId: string,
  d1?: D1Database,
): Promise<AcceptHouseholdInvitationResult> {
  const db = getDb(d1);
  // DB には秒単位で保存されるため、INSERT の条件で比べられるよう秒に切り捨てておく
  const now = new Date(toUnixSeconds(new Date()) * 1000);
  const tokenHash = await hashSessionToken(token);
  const notMemberCondition = sql`NOT EXISTS (
    SELECT 1 FROM ${householdMembers} AS m
    WHERE m.household_id = ${householdInvitations.householdId}
      AND m.user_id = ${userId}
  )`;

  const [claimed] = await db.batch([
    db
      .update(householdInvitations)
      .set({ acceptedByUserId: userId, acceptedAt: now })
      .where(
        and(
          eq(householdInvitations.tokenHash, tokenHash),
          isNull(householdInvitations.acceptedByUserId),
          gt(householdInvitations.expiresAt, now),
          notMemberCondition,
        ),
      )
      .returning({ householdId: householdInvitations.householdId }),
    // 以前この招待で参加して家から抜けたユーザーが開き直しても、使用済みにした日時が
    // 一致しないため参加し直せない（参加・脱退・開き直しが同じ 1 秒の中で起きた場合だけは、
    // 本人が参加し直せてしまうが、招待された本人のため実害はない）
    db.insert(householdMembers).select(
      db
        .select({
          householdId: householdInvitations.householdId,
          userId: sql`${userId}`.as("user_id"),
          role: sql`'member'`.as("role"),
          createdAt: sql`${toUnixSeconds(now)}`.as("created_at"),
        })
        .from(householdInvitations)
        .where(
          and(
            eq(householdInvitations.tokenHash, tokenHash),
            eq(householdInvitations.acceptedByUserId, userId),
            eq(householdInvitations.acceptedAt, now),
            notMemberCondition,
          ),
        ),
    ),
  ]);

  const [invitation] = claimed;
  if (!invitation) {
    return {
      ok: false,
      error:
        "家に参加できませんでした。招待 URL の期限が切れているか、すでに使われています",
    };
  }
  return { ok: true, householdId: invitation.householdId };
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}
