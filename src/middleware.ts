import { type NextRequest, NextResponse } from "next/server";
import { isPublicPath } from "@/features/auth/publicPaths";
import { getSessionUser } from "@/features/auth/sessions";
import { SESSION_COOKIE_NAME } from "@/features/auth/sessionToken";

// Next.js 16 では `proxy.ts`（Node.js ランタイム固定）が推奨だが、OpenNext の
// Cloudflare 向けビルドでは Node.js ランタイムのミドルウェアが実験的な扱いのため、
// Edge ランタイムで動く `middleware.ts` を使う。
//
// ここでは Cookie のセッショントークンが D1 の有効なセッションに対応するかだけを確認し、
// 猫ごとの認可はページ・Server Action 側で行う（`src/features/auth/session.ts`）。
// 家に関係しないページ（ごはん商品など）はページ側でユーザーを確認しないため、
// Cookie があるかどうかだけで通さず、必ず DB のセッションと照合する
export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token && (await getSessionUser(token))) {
    return NextResponse.next();
  }

  // API・メディア配信はリダイレクト先の HTML を返しても使えないため 401 にする
  const response =
    pathname.startsWith("/api/") || pathname.startsWith("/media/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(loginUrl(request, `${pathname}${search}`));
  // 期限切れ・ログアウト済みのセッションの Cookie は残しておいても使えないため消す
  if (token) {
    response.cookies.delete(SESSION_COOKIE_NAME);
  }
  return response;
}

function loginUrl(request: NextRequest, callbackUrl: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("callbackUrl", callbackUrl);
  return url;
}

export const config = {
  // ビルド成果物（`/_next/`）は対象外にする
  matcher: ["/((?!_next/).*)"],
};
