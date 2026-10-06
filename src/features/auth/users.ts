import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

/** ユーザーが 1 件もないときに、最初のログインで作る管理者ユーザーの名前 */
export const INITIAL_USER_NAME = "管理者";

/**
 * `/login` のログインボタンで使うユーザーを返す。認証を実装するまでは、
 * 最初に登録されたユーザーを常に使い、ユーザーが 1 件もなければ管理者として作る。
 *
 * 同時に初回ログインが走っても 2 件作られないよう、「ユーザーがいなければ挿入」を
 * 1 つの INSERT 文で行う（SQLite では 1 文の実行がアトミック）
 */
export async function getOrCreateLoginUser(d1?: D1Database) {
  const db = getDb(d1);
  await db.run(sql`
    INSERT INTO ${users} (id, name, role)
    SELECT ${crypto.randomUUID()}, ${INITIAL_USER_NAME}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM ${users})
  `);
  const [user] = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(1);
  return user;
}

export async function getUserById(id: string, d1?: D1Database) {
  const db = getDb(d1);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
