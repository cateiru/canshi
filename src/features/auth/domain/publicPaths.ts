/** 未ログインでも 401／ログイン画面へのリダイレクトにしないパス（前方一致） */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  // PWA のインストール・オフライン表示に必要なもの。ログイン画面へリダイレクトすると
  // manifest やアイコンを取得できずインストールできなくなる
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
  "/icons/",
  "/images/",
  "/icon.svg",
  "/favicon.ico",
  "/opengraph-image",
];

/**
 * 未ログインでも見られるページ（そのパスと、その下のパス）。ヘルプはログイン前にも読めるようにする。
 * 見た目設定は端末ごとの cookie に保存するだけでアカウントに関係しないため、
 * ログイン画面の文字の大きさや配色もログイン前に変えられるようにする
 */
const PUBLIC_PAGE_PATHS = ["/help", "/settings/appearance"];

/**
 * ログインのセッションではなく API トークンで認証するパス（そのパスと、その下のパス）。
 * 認証は `src/features/api/presentation/app.ts` で行う
 */
const TOKEN_AUTH_PATHS = ["/api/v1"];

/** middleware（`src/middleware.ts`）でセッションを確認しないパスかどうか */
export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    [...PUBLIC_PAGE_PATHS, ...TOKEN_AUTH_PATHS].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}
