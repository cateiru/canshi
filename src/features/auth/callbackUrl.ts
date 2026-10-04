/** ログイン後の遷移先の既定値 */
export const DEFAULT_CALLBACK_URL = "/";

/**
 * `/login?callbackUrl=...` の値を、ログイン後に遷移してよいアプリ内のパスに限定する。
 * 外部サイトへのオープンリダイレクトを防ぐため、`/` で始まる相対パス以外
 * （`https://...`・`//example.com`・`/\example.com` など）は既定値にする
 */
export function sanitizeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_CALLBACK_URL;
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_CALLBACK_URL;
  }
  if (value === "/login" || value.startsWith("/login?")) {
    return DEFAULT_CALLBACK_URL;
  }
  return value;
}
