import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getEmailHashSalt, hashEmail } from "./emailHash";

/** ユーザーが 1 件もないときに、最初のログインで作る管理者ユーザーの名前 */
export const INITIAL_USER_NAME = "管理者";

/**
 * 2 人目以降に新しく作るユーザーの名前。個人情報を持たないよう、メールアドレスからは作らない。
 * ログイン後にアカウント設定で変えてもらう
 */
export const NEW_USER_NAME = "ユーザー";

/**
 * 環境変数の SALT でメールアドレスをハッシュにする。開発環境（`next dev`）に限り、
 * `EMAIL_HASH_SALT` が未設定でも開発用の SALT を使う
 */
export function hashEmailWithEnv(
  email: string,
  env: Pick<CloudflareEnv, "EMAIL_HASH_SALT">,
) {
  const salt = getEmailHashSalt(env.EMAIL_HASH_SALT, {
    allowDevelopmentSalt: process.env.NODE_ENV === "development",
  });
  return hashEmail(email, salt);
}

/** メールアドレスのハッシュに対応するユーザー。いなければ null */
export async function findUserByEmailHash(emailHash: string, d1?: D1Database) {
  const db = getDb(d1);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.emailHash, emailHash))
    .limit(1);
  return user ?? null;
}

/**
 * ログインしたメールアドレスのハッシュに対応するユーザーを返し、いなければ作る。
 * ユーザーが 1 件もなければ管理者として、それ以外は一般のユーザーとして作る。
 *
 * 同じメールアドレスで同時にログインしても 2 件作られないよう、「いなければ挿入」を
 * `email_hash` の一意制約と `ON CONFLICT DO NOTHING` で 1 つの INSERT 文にする
 * （SQLite では 1 文の実行がアトミック。`INSERT ... SELECT` に `ON CONFLICT` を付けるときは、
 * 構文の曖昧さを避けるため `WHERE true` が必要）
 */
export async function findOrCreateUserByEmailHash(
  emailHash: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  await db.run(sql`
    INSERT INTO ${users} (id, name, role, email_hash)
    SELECT
      ${crypto.randomUUID()},
      CASE WHEN EXISTS (SELECT 1 FROM ${users}) THEN ${NEW_USER_NAME} ELSE ${INITIAL_USER_NAME} END,
      CASE WHEN EXISTS (SELECT 1 FROM ${users}) THEN 'member' ELSE 'admin' END,
      ${emailHash}
    WHERE true
    ON CONFLICT (email_hash) DO NOTHING
  `);
  const user = await findUserByEmailHash(emailHash, d1);
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
