import { createSession } from "./sessions";
import { findOrCreateUserByEmailHash, hashEmailWithEnv } from "./users";

/**
 * 認証済みのメールアドレスでログインする。メールアドレスのハッシュに対応するユーザー
 * （いなければ新しく作ったユーザー）のセッションを作り、Cookie に保存するトークンと
 * 有効期限を返す。メールアドレスそのものは保存しない。`userAgent` はログインした
 * ブラウザの User-Agent で、端末一覧に表示するためにセッションに保存する
 */
export async function loginWithEmail(
  email: string,
  env: Pick<CloudflareEnv, "EMAIL_HASH_SALT">,
  userAgent: string | null,
) {
  const user = await findOrCreateUserByEmailHash(hashEmailWithEnv(email, env));
  return createSession(user.id, { userAgent });
}
