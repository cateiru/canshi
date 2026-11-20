import { normalizeEmail } from "../domain/email";
import { createSession } from "../infrastructure/sessions";
import {
  findOrCreateUserByEmail,
  findUnlinkedUserByEmailHash,
  findUserByEmail,
  hashEmailWithEnv,
  linkUserEmail,
} from "../infrastructure/users";

/**
 * 認証済みのメールアドレスでログインする。メールアドレスのユーザー（いなければ新しく作った
 * ユーザー）のセッションを作り、Cookie に保存するトークンと有効期限を返す。
 * `userAgent` はログインしたブラウザの User-Agent で、端末一覧に表示するためにセッションに保存する。
 * `isNewUser` は、このログインでユーザーを新しく作ったか（はじめてのログインか）。
 * はじめてガイドをはじめるかどうかの判断に使う
 */
export async function loginWithEmail(
  email: string,
  env: Pick<
    CloudflareEnv,
    "EMAIL_HASH_SALT" | "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN"
  >,
  userAgent: string | null,
) {
  const { user, isNewUser } = await findOrCreateLoginUser(
    normalizeEmail(email),
    env,
  );
  const session = await createSession(user.id, { userAgent });
  return { ...session, userId: user.id, isNewUser };
}

/**
 * メールアドレスのユーザーを探し、いなければ作る。
 *
 * メールアドレスをハッシュにして保存していたころ（#593 より前）のユーザーは `email` を持たないため、
 * `email` で見つからなければ `email_hash` でも探し、見つかればメールアドレスを保存して同じユーザーとして
 * ログインさせる。ハッシュの計算は重いため、`email` で見つかったときは計算しない
 */
async function findOrCreateLoginUser(
  email: string,
  env: Pick<
    CloudflareEnv,
    "EMAIL_HASH_SALT" | "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN"
  >,
) {
  const user = await findUserByEmail(email);
  if (user) {
    return { user, isNewUser: false };
  }
  const unlinked = await findUnlinkedUserByEmailHash(
    hashEmailWithEnv(email, env),
  );
  if (unlinked) {
    return { user: await linkUserEmail(unlinked.id, email), isNewUser: false };
  }
  // 同時に同じメールアドレスでログインした場合は、もう一方が作ったユーザーが返る
  const created = await findOrCreateUserByEmail(email);
  return { user: created, isNewUser: true };
}
