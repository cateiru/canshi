/** ログインセッションのトークンを保存する Cookie の名前 */
export const SESSION_COOKIE_NAME = "canshi-session";

/** セッションの有効期間。ログインから延長せず、期限が切れたら再度ログインする */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Cookie に保存するセッショントークン（32 バイトの乱数を base64url にしたもの）を作る。
 * middleware（Edge ランタイム）からも使うため、Node.js の `crypto` ではなく Web Crypto を使う
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * DB に保存するセッショントークンのハッシュ（SHA-256 の 16 進文字列）。DB には
 * トークンそのものを保存せず、DB が漏れても Cookie を偽造できないようにする
 */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
