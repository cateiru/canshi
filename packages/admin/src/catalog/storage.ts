/**
 * 共通のごはん商品の画像も、メインアプリのメディアと同じ R2 バケット・同じ保存容量の上限を使う
 * （`media_assets` の合計に数えられる）。上限はメインアプリの `MEDIA_STORAGE_LIMIT_BYTES`
 * （`src/features/media/limits.ts`）と同じ名前の環境変数で上書きでき、未設定・不正な値は同じ既定値にする。
 * メインアプリで上限を変えたときは、管理画面にも同じ値を設定すること
 */

/** メインアプリの `DEFAULT_MEDIA_LIMITS.storageLimitBytes` と同じ値 */
export const DEFAULT_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export const STORAGE_LIMIT_ENV_KEY = "MEDIA_STORAGE_LIMIT_BYTES";

export function resolveStorageLimitBytes(env: object): number {
  const value = (env as Record<string, unknown>)[STORAGE_LIMIT_ENV_KEY];
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_STORAGE_LIMIT_BYTES;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_STORAGE_LIMIT_BYTES;
}
