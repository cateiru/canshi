import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig, resolveAuthSecret } from "@/auth.config";
import { getOrCreateLoginUser } from "@/features/auth/users";

/**
 * `AUTH_SECRET` などの環境変数は Cloudflare Workers ではリクエストごとに
 * `process.env` へ注入されるため、設定は関数で渡してリクエスト時に評価させる
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  secret: resolveAuthSecret(),
  providers: [
    // 認証はまだ実装しない（Issue #160）。ログインボタンを押すと、
    // 登録済みのユーザー（いなければ新しく作った管理者ユーザー）としてログインする
    Credentials({
      credentials: {},
      async authorize() {
        const user = await getOrCreateLoginUser();
        return { id: user.id, name: user.name };
      },
    }),
  ],
}));
