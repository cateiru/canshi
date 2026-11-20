import { normalizeEmail } from "../domain/email";
import { createSession } from "../infrastructure/sessions";
import {
  findOrCreateUserByEmail,
  findUserByEmail,
} from "../infrastructure/users";

/**
 * 認証済みのメールアドレスでログインする。メールアドレスのユーザー（いなければ新しく作った
 * ユーザー）のセッションを作り、Cookie に保存するトークンと有効期限を返す。
 * `userAgent` はログインしたブラウザの User-Agent で、端末一覧に表示するためにセッションに保存する。
 * `isNewUser` は、このログインでユーザーを新しく作ったか（はじめてのログインか）。
 * はじめてガイドをはじめるかどうかの判断に使う
 */
export async function loginWithEmail(email: string, userAgent: string | null) {
  const normalized = normalizeEmail(email);
  const isNewUser = (await findUserByEmail(normalized)) === null;
  const user = await findOrCreateUserByEmail(normalized);
  const session = await createSession(user.id, { userAgent });
  return { ...session, userId: user.id, isNewUser };
}
