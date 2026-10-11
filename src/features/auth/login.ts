import { createSession } from "./sessions";
import { findOrCreateUserByEmailHash, hashEmailWithEnv } from "./users";

/**
 * 認証済みのメールアドレスでログインする。メールアドレスのハッシュに対応するユーザー
 * （いなければ新しく作ったユーザー）のセッションを作り、Cookie に保存するトークンと
 * 有効期限を返す。メールアドレスそのものは保存しない
 */
export async function loginWithEmail(
  email: string,
  env: Pick<CloudflareEnv, "EMAIL_HASH_SALT">,
) {
  const user = await findOrCreateUserByEmailHash(hashEmailWithEnv(email, env));
  return createSession(user.id);
}
