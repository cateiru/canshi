import { getOidcConfig } from "./oidc";

/** 開発用ログインのメールアドレスの初期値。e2e・VRT（`e2e/auth.setup.ts`）もこれでログインする */
export const DEVELOPMENT_LOGIN_EMAIL = "e2e@example.com";

type DevelopmentLoginEnv = Parameters<typeof getOidcConfig>[0] &
  Pick<CloudflareEnv, "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN">;

/**
 * 実行時の環境変数 `DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN` が `"true"` か。
 * Worker Previews（`wrangler preview`）の `[previews.vars]` だけで設定し、本番（トップレベルの
 * `[vars]`・シークレット）には決して設定しない。本番のドメインは Cloudflare Access で
 * 保護していないため、本番で有効になると誰でも任意のメールアドレスでログインできてしまう
 * （`wrangler.toml`・`docs/deploy.md` の「プレビュー（Worker Previews）」節を参照）
 */
export function isDangerousDevelopmentLoginEnabled(
  env: Pick<CloudflareEnv, "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN">,
) {
  return env.DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN === "true";
}

/**
 * 開発用のログイン（メールアドレスの入力だけでログインする）を使うかどうか。
 * 次のどちらかのときだけ使う。
 *
 * - `next dev` で、かつ OIDC が未設定のとき。OIDC を設定すれば、開発環境でも
 *   Cloudflare Access でのログインを確認できる
 * - `DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN` が `"true"` のとき（Worker Previews。
 *   プレビューは本番ビルドのため `process.env.NODE_ENV` では切り替えられない）
 *
 * `process.env.NODE_ENV` はビルド時に置き換わるため、本番ビルドでは前者は常に false になる。
 * 本番で OIDC が未設定でも、ここで開発用のログインに切り替わることはない
 */
export function isDevelopmentLoginEnabled(env: DevelopmentLoginEnv) {
  if (isDangerousDevelopmentLoginEnabled(env)) {
    return true;
  }
  return process.env.NODE_ENV === "development" && getOidcConfig(env) === null;
}
