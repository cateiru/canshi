// `src/features/auth/domain/emailHash.ts` と同じく、Node.js から直接実行するスクリプト
// （`scripts/link-user-email.mts`・`scripts/link-household.mts`）からも import する。
// パスエイリアス（`@/`）を使わず、ほかのモジュールに依存しないようにする

/**
 * メールアドレスの大文字・小文字や前後の空白の違いで別のユーザーにならないよう揃える。
 * `users.email` にはこの値を保存し、同じユーザーかどうかもこの値で判定する
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
