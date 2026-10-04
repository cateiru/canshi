/** ログイン後の遷移先の既定値 */
export const DEFAULT_CALLBACK_URL = "/";

/** 相対パスを解釈するための仮のオリジン。結果がこのオリジンのままかで外部への遷移を判定する */
const BASE_ORIGIN = "http://canshi.invalid";

/**
 * `/login?callbackUrl=...` の値を、ログイン後に遷移してよいアプリ内のパスに限定する。
 * 外部サイトへのオープンリダイレクトを防ぐため、`/` で始まる相対パス以外
 * （`https://...`・`//example.com`・`/\example.com` など）は既定値にする。
 *
 * ブラウザ（と Next.js のリダイレクト）は URL を解釈するときにタブ・改行を取り除くため、
 * `/\t/example.com` は `//example.com` として外部へ遷移してしまう。制御文字を拒否したうえで、
 * URL として解釈し直した結果が同じオリジンのパスであることを確かめ、解釈後のパスを返す
 */
export function sanitizeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_CALLBACK_URL;
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を拒否するため
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return DEFAULT_CALLBACK_URL;
  }

  let url: URL;
  try {
    url = new URL(value, BASE_ORIGIN);
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
  if (url.origin !== BASE_ORIGIN || url.pathname === "/login") {
    return DEFAULT_CALLBACK_URL;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
