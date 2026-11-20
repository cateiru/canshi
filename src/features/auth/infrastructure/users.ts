import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getEmailHashSalt, hashEmail } from "../domain/emailHash";
import { isDangerousDevelopmentLoginEnabled } from "./developmentLogin";

/** ユーザーが 1 件もないときに、最初のログインで作る管理者ユーザーの名前 */
export const INITIAL_USER_NAME = "管理者";

/**
 * 2 人目以降に新しく作るユーザーの名前。個人情報を持たないよう、メールアドレスからは作らない。
 * ログイン後にアカウント設定で変えてもらう
 */
export const NEW_USER_NAME = "ユーザー";

/**
 * 環境変数の SALT でメールアドレスをハッシュにする（`email` を持たない既存のユーザーを探すときだけ使う）。開発環境（`next dev`）と、
 * `DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN` を有効にした Worker Previews（本番とは別の D1 を使う）に
 * 限り、`EMAIL_HASH_SALT` が未設定でも開発用の SALT を使う
 */
export function hashEmailWithEnv(
  email: string,
  env: Pick<
    CloudflareEnv,
    "EMAIL_HASH_SALT" | "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN"
  >,
) {
  const salt = getEmailHashSalt(env.EMAIL_HASH_SALT, {
    allowDevelopmentSalt:
      process.env.NODE_ENV === "development" ||
      isDangerousDevelopmentLoginEnabled(env),
  });
  return hashEmail(email, salt);
}

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
 * メールアドレスのハッシュに対応し、まだ `email` を持たない既存のユーザー。いなければ null。
 * メールアドレスをハッシュにして保存していたころ（#593 より前）のユーザーを探すために使う
 */
export async function findUnlinkedUserByEmailHash(
  emailHash: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.emailHash, emailHash), isNull(users.email)))
    .limit(1);
  return user ?? null;
}

/**
 * `email` を持たない既存のユーザーに、ログインしたメールアドレスを保存してユーザーを返す。
 * 同じユーザーが同時にログインしても上書きし合わないよう、`email` が NULL のときだけ更新する
 */
export async function linkUserEmail(
  userId: string,
  email: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  await db
    .update(users)
    .set({ email, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.email)));
  const user = await findUserByEmail(email, d1);
  if (user?.id !== userId) {
    throw new Error(
      "ログインしたユーザーにメールアドレスを保存できませんでした",
    );
  }
  return user;
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
