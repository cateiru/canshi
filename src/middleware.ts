import { type NextFetchEvent, NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig, resolveAuthSecret } from "@/auth.config";
import { isPublicPath } from "@/features/auth/publicPaths";

// Next.js 16 では `proxy.ts`（Node.js ランタイム固定）が推奨だが、OpenNext の
// Cloudflare 向けビルドでは Node.js ランタイムのミドルウェアが実験的な扱いのため、
// Edge ランタイムで動く `middleware.ts` を使う。ここでは Cookie の JWT を検証して
// セッションの有無だけを判定し、猫ごとの認可はページ・Server Action 側で行う
// （`src/features/auth/session.ts`）。
//
// OpenNext は Workers のシークレットをリクエストの処理時に `process.env` へ注入するため、
// モジュールの評価時点では `AUTH_SECRET` を読めない。`src/auth.ts` と同じく設定は関数で
// 渡してリクエストごとに評価させる。この場合 `auth(handler)` は handler を返す Promise に
// なるため、default export の関数の中で await してから呼び出す
const { auth } = NextAuth(() => ({
  ...authConfig,
  secret: resolveAuthSecret(),
}));

const authMiddleware = auth((request) => {
  const { pathname, search } = request.nextUrl;
  if (request.auth?.user) {
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

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // 公開パスではセッションを読まない。読むと Auth.js が CSRF トークンの Cookie を発行し、
  // `/api/auth/*` 自身が発行する Cookie と食い違ってログインに失敗することがある
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const handler = await authMiddleware;
  // next-auth の型は Route Handler の第 2 引数（params）を前提にしているが、ここでは
  // middleware の FetchEvent をそのまま渡す（上のコールバックは第 2 引数を使わない）
  const response = await handler(
    withForwardedProto(request),
    event as unknown as Parameters<typeof handler>[1],
  );
  return response ? withoutSetCookie(response) : NextResponse.next();
}

/**
 * Auth.js の middleware はセッションを読むたびに、有効期限を延ばしたセッションの Cookie を
 * レスポンスに付ける。ログアウト（Server Action の POST）では、この Cookie が `signOut` による
 * 削除を上書きしてログアウトできなくなるうえ、ログアウトの前に送られたプリフェッチの
 * レスポンスでもセッションが復活しうる。middleware はセッションの有無を判定するだけにし、
 * Cookie の発行・削除はログイン・ログアウトの処理（`src/features/auth/actions.ts`）に任せる。
 * そのためセッションの有効期限はログインした時点から延びない（`src/auth.config.ts`）
 */
function withoutSetCookie(response: Response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Auth.js は middleware でセッションを読むとき、`X-Forwarded-Proto` が無いと https とみなして
 * `__Secure-` 付きの Cookie 名を探す。Workers をローカルの http で動かす `pnpm cf:preview`
 * ではこのヘッダーが付かず、ログインしても Cookie を見つけられないため、リクエストの URL の
 * プロトコルで補う。偽装されても Cookie 名が変わるだけで、JWT の検証は省略されない
 */
function withForwardedProto(request: NextRequest) {
  if (request.headers.has("x-forwarded-proto")) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  return new NextRequest(request, { headers });
}

export const config = {
  // ビルド成果物（`/_next/`）は対象外にする
  matcher: ["/((?!_next/).*)"],
};
