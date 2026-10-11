import { getOidcConfig } from "./oidc";

/** 開発用ログインのメールアドレスの初期値。e2e・VRT（`e2e/auth.setup.ts`）もこれでログインする */
export const DEVELOPMENT_LOGIN_EMAIL = "e2e@example.com";

/**
 * 開発用のログイン（メールアドレスの入力だけでログインする）を使うかどうか。
 * `next dev` で、かつ OIDC が未設定のときだけ使う。OIDC を設定すれば、開発環境でも
 * Cloudflare Access でのログインを確認できる。
 *
 * `process.env.NODE_ENV` はビルド時に置き換わるため、本番ビルドでは常に false になる。
 * 本番で OIDC が未設定でも、ここで開発用のログインに切り替わることはない
 */
export function isDevelopmentLoginEnabled(
  env: Parameters<typeof getOidcConfig>[0],
) {
  return process.env.NODE_ENV === "development" && getOidcConfig(env) === null;
}
