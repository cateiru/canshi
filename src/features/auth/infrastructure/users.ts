import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

/** ユーザーが 1 件もないときに、最初のログインで作る管理者ユーザーの名前 */
export const INITIAL_USER_NAME = "管理者";

/**
 * 2 人目以降に新しく作るユーザーの名前。個人情報を持たないよう、メールアドレスからは作らない。
 * ログイン後にアカウント設定で変えてもらう
 */
export const NEW_USER_NAME = "ユーザー";

/** メールアドレス（`normalizeEmail` で正規化した値）のユーザー。いなければ null */
export async function findUserByEmail(email: string, d1?: D1Database) {
  const db = getDb(d1);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

/**
 * ログインしたメールアドレスのユーザーを返し、いなければ作る。
 * ユーザーが 1 件もなければ管理者として、それ以外は一般のユーザーとして作る。
 *
 * 同じメールアドレスで同時にログインしても 2 件作られないよう、「いなければ挿入」を
 * `email` の一意制約と `ON CONFLICT DO NOTHING` で 1 つの INSERT 文にする
 * （SQLite では 1 文の実行がアトミック。`INSERT ... SELECT` に `ON CONFLICT` を付けるときは、
 * 構文の曖昧さを避けるため `WHERE true` が必要）
 */
export async function findOrCreateUserByEmail(email: string, d1?: D1Database) {
  const db = getDb(d1);
  await db.run(sql`
    INSERT INTO ${users} (id, name, role, email)
    SELECT
      ${crypto.randomUUID()},
      CASE WHEN EXISTS (SELECT 1 FROM ${users}) THEN ${NEW_USER_NAME} ELSE ${INITIAL_USER_NAME} END,
      CASE WHEN EXISTS (SELECT 1 FROM ${users}) THEN 'member' ELSE 'admin' END,
      ${email}
    WHERE true
    ON CONFLICT (email) DO NOTHING
  `);
  const user = await findUserByEmail(email, d1);
  if (!user) {
    throw new Error("ログインしたユーザーを作成できませんでした");
  }
  return user;
}

export async function getUserById(id: string, d1?: D1Database) {
  const db = getDb(d1);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
