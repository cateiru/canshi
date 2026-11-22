import { getOidcConfig } from "./oidc";

/** 開発用ログインのメールアドレスの初期値。e2e・VRT（`e2e/auth.setup.ts`）もこれでログインする */
export const DEVELOPMENT_LOGIN_EMAIL = "e2e@example.com";

type DevelopmentLoginEnv = Parameters<typeof getOidcConfig>[0] &
  Pick<Env, "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN">;

/**
 * 実行時の環境変数 `DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN` が `"true"` か。
 * Worker Previews（`vinext-cloudflare previews deploy`）の設定（`cloudflare.config.ts` の `isPreview`）だけで設定し、本番の
 * 変数・シークレットには決して設定しない。本番のドメインは Cloudflare Access で
 * 保護していないため、本番で有効になると誰でも任意のメールアドレスでログインできてしまう
 * （`cloudflare.config.ts`・`docs/deploy.md` の「プレビュー（Worker Previews）」節を参照）
 */
export function isDangerousDevelopmentLoginEnabled(
  env: Pick<Env, "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN">,
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

/**
 * 開発用のページ（`/dev/*`。部品の一覧・VRT 用の固定表示など）を出すかどうか。
 * `next dev` と、`DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN` を有効にした Worker Previews（本番とは別の
 * D1・R2 を使う）でだけ出し、本番では出さない（プレビューは本番ビルドのため、`process.env.NODE_ENV`
 * だけでは切り替えられない）
 */
export function isDevPagesEnabled(
  env: Pick<Env, "DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN">,
) {
  return (
    process.env.NODE_ENV !== "production" ||
    isDangerousDevelopmentLoginEnabled(env)
  );
}
