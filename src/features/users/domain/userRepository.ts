/**
 * ユーザーのプロフィールの保存先。ログイン・セッションは `src/features/auth/infrastructure` で扱う。
 * 実装は `../infrastructure/userRepository.ts`
 */
export interface UserRepository {
  /** ユーザーの名前を変える */
  rename(userId: string, name: string): Promise<void>;
}
