import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { normalizeUserAgent } from "./deviceName";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from "./sessionToken";

/**
 * ユーザーのログインセッションを作り、Cookie に保存するトークンと有効期限を返す。
 * ログインしたブラウザの User-Agent は端末一覧の表示用に保存する。
 * ついでに、そのユーザーの期限切れのセッションを削除する
 */
export async function createSession(
  userId: string,
  { userAgent }: { userAgent?: string | null } = {},
  d1?: D1Database,
) {
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
    userAgent: normalizeUserAgent(userAgent),
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

/**
 * ユーザーのログイン中のセッション（期限内のもの）を、`currentToken` のセッション（この端末）、
 * 新しくログインした順の残りの順に返す。この端末のセッションには `isCurrent` を立てる。トークンのハッシュは返さず、
 * 個別にログアウトするときは `id` を使う
 */
export async function listUserSessions(
  userId: string,
  currentToken: string | undefined,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const currentTokenHash = currentToken
    ? await hashSessionToken(currentToken)
    : null;
  const rows = await db
    .select({
      id: sessions.id,
      tokenHash: sessions.tokenHash,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    // created_at は秒単位のため、同じ秒にログインしたものは rowid（挿入順）で新しい順に並べる
    .orderBy(desc(sessions.createdAt), desc(sql`rowid`));
  // この端末を見つけやすいよう、先頭に出す（ほかは新しい順のまま）
  return rows
    .map(({ tokenHash, ...row }) => ({
      ...row,
      isCurrent: tokenHash === currentTokenHash,
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

/**
 * ユーザーのセッションを 1 つ削除する（端末を指定してログアウト）。別のユーザーのセッションは
 * 削除しないよう、ユーザーの一致を WHERE に含める。削除したセッションがあれば、それが
 * `currentToken` のセッションかどうかを返す
 */
export async function deleteUserSession(
  userId: string,
  sessionId: string,
  currentToken: string | undefined,
  d1?: D1Database,
): Promise<{ deleted: boolean; isCurrent: boolean }> {
  const db = getDb(d1);
  const [row] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ tokenHash: sessions.tokenHash });
  if (!row) {
    return { deleted: false, isCurrent: false };
  }
  return {
    deleted: true,
    isCurrent:
      currentToken !== undefined &&
      row.tokenHash === (await hashSessionToken(currentToken)),
  };
}

/**
 * ユーザーのセッションをすべて削除する（すべての端末からログアウト）。ほかの端末に残った
 * Cookie も、次のリクエストからは使えなくなる
 */
export async function deleteUserSessions(userId: string, d1?: D1Database) {
  const db = getDb(d1);
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
