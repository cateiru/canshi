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

/** 未ログインでも見られるページ（そのパスと、その下のパス）。ヘルプはログイン前にも読めるようにする */
const PUBLIC_PAGE_PATHS = ["/help"];

/** middleware（`src/middleware.ts`）でセッションを確認しないパスかどうか */
export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_PAGE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}
