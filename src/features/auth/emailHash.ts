// メインアプリ（Workers）に加えて、Node.js から直接実行するスクリプト
// （`scripts/link-user-email.mts`・`scripts/link-household.mts`）からも import する。
// 同じ処理でハッシュにしないと別のユーザーとして扱われるため、このファイルは
// パスエイリアス（`@/`）を使わず、npm パッケージ以外に依存しないようにする
import { argon2id } from "@noble/hashes/argon2.js";

/**
 * argon2id のパラメータ（OWASP の推奨値: メモリ 19 MiB・反復 2 回・並列度 1）。
 * **変えると既存のユーザーのハッシュと一致しなくなり、全員が別のユーザーとして扱われる。**
 * SALT と同じく、運用を始めたあとは変えないこと
 */
export const EMAIL_HASH_PARAMS = {
  t: 2,
  m: 19 * 1024,
  p: 1,
  dkLen: 32,
} as const;

/** SALT の最小の長さ。argon2 の salt は 8 バイト以上が必要だが、推測されにくいよう長めにする */
export const MIN_EMAIL_HASH_SALT_LENGTH = 16;

/**
 * 開発環境（`next dev`）とローカルのスクリプトで、`EMAIL_HASH_SALT` が未設定のときに使う SALT。
 * e2e・VRT（`e2e/fixtures/vrt-seed.sql`）はこの値でハッシュにしたメールアドレスを前提にする。
 * 本番では使わない（`getEmailHashSalt` は未設定ならエラーにする）
 */
export const DEVELOPMENT_EMAIL_HASH_SALT = "canshi-development-email-hash-salt";

/** メールアドレスの大文字・小文字や前後の空白の違いで別のユーザーにならないよう揃える */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * `EMAIL_HASH_SALT` を返す。未設定の場合は、開発環境（`allowDevelopmentSalt`）なら
 * 開発用の SALT を使い、それ以外はエラーにする。短すぎる SALT もエラーにする
 */
export function getEmailHashSalt(
  salt: string | undefined,
  { allowDevelopmentSalt }: { allowDevelopmentSalt: boolean },
): string {
  if (!salt) {
    if (allowDevelopmentSalt) {
      return DEVELOPMENT_EMAIL_HASH_SALT;
    }
    throw new Error("EMAIL_HASH_SALT が設定されていません");
  }
  if (salt.length < MIN_EMAIL_HASH_SALT_LENGTH) {
    throw new Error(
      `EMAIL_HASH_SALT は ${MIN_EMAIL_HASH_SALT_LENGTH} 文字以上にしてください`,
    );
  }
  return salt;
}

/**
 * メールアドレスを正規化してから、SALT を使って argon2id でハッシュにする（16 進文字列）。
 * DB にはこの値だけを保存し、同じユーザーかどうかもこの値で判定する。
 * 同じメールアドレス・SALT からは常に同じ値になる。
 *
 * CPU を 200 ms 以上使うため、ログイン時（OIDC のコールバック）など必要なときだけ呼び、
 * リクエストごとの認証（middleware）では呼ばない
 */
export function hashEmail(email: string, salt: string): string {
  const encoder = new TextEncoder();
  const hash = argon2id(
    encoder.encode(normalizeEmail(email)),
    encoder.encode(salt),
    EMAIL_HASH_PARAMS,
  );
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
