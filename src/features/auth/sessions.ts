import { and, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from "./sessionToken";

/**
 * ユーザーのログインセッションを作り、Cookie に保存するトークンと有効期限を返す。
 * ついでに、そのユーザーの期限切れのセッションを削除する
 */
export async function createSession(userId: string, d1?: D1Database) {
  const db = getDb(d1);
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));
  await db.insert(sessions).values({
    tokenHash: await hashSessionToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * セッショントークンに対応するユーザーを返す。存在しない・期限切れのセッションや、
 * セッションのユーザーが削除されている場合は null
 */
export async function getSessionUser(token: string, d1?: D1Database) {
  const db = getDb(d1);
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, await hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.user ?? null;
}

/** ログアウトしたセッションを削除する。以降そのトークンでは何も参照できない */
export async function deleteSession(token: string, d1?: D1Database) {
  const db = getDb(d1);
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, await hashSessionToken(token)));
}
