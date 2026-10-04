import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig, resolveAuthSecret } from "@/auth.config";
import { isPublicPath } from "@/features/auth/publicPaths";

// Next.js 16 では `proxy.ts`（Node.js ランタイム固定）が推奨だが、OpenNext の
// Cloudflare 向けビルドでは Node.js ランタイムのミドルウェアが実験的な扱いのため、
// Edge ランタイムで動く `middleware.ts` を使う。ここでは Cookie の JWT を検証して
// セッションの有無だけを判定し、猫ごとの認可はページ・Server Action 側で行う
// （`src/features/auth/session.ts`）。
//
// `src/auth.ts` と違い設定を関数（遅延評価）で渡さないのは、遅延評価だと `auth(handler)` が
// Promise を返し、middleware の default export が関数として認識されないため。
// Workers（`nodejs_compat`）ではモジュールの評価時点で `process.env` にシークレットが
// 入っているため、`AUTH_SECRET` はここで読める
const { auth } = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
});

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  if (request.auth?.user || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // API・メディア配信はリダイレクト先の HTML を返しても使えないため 401 にする
  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // ビルド成果物（`/_next/`）は対象外にする
  matcher: ["/((?!_next/).*)"],
};
