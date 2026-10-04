import type { NextAuthConfig } from "next-auth";

/**
 * セッションの JWT の署名・暗号化に使う秘密鍵。本番は `AUTH_SECRET`
 * （`wrangler secret put`）が必須で、未設定なら Auth.js がエラーにする。
 * `next dev`（ローカル開発・CI の e2e）では未設定でも動くよう固定値を使う
 */
export function resolveAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NODE_ENV === "development") {
    return "canshi-development-only-auth-secret";
  }
  return undefined;
}

/**
 * Auth.js の設定のうち、middleware（Edge ランタイム）からも読み込む部分。
 * middleware では Cookie の JWT を検証するだけなので、DB にアクセスするモジュール
 * （`getDb()` など）はここから import しないこと。ログイン時の処理（Credentials
 * provider）は `src/auth.ts` で追加する
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  // Credentials provider はデータベースセッションに対応していないため、
  // セッションは署名・暗号化した JWT として Cookie に保持する
  session: {
    strategy: "jwt",
    // middleware ではセッションの Cookie を更新しない（`src/middleware.ts`）ため、
    // ログインから 30 日で期限が切れ、再度ログインが必要になる
    maxAge: 30 * 24 * 60 * 60,
  },
  // Cloudflare Workers の前段（カスタムドメイン・workers.dev）から届く Host ヘッダーを
  // 信頼する。未設定だと本番で UntrustedHost エラーになる
  trustHost: true,
  providers: [],
  callbacks: {
    session({ session, token }) {
      // JWT の `sub` にはログイン時のユーザー ID（`authorize()` が返した `id`）が入る
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
