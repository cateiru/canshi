import type { AccessPermissions } from "@/features/external-access/domain/permissionRules";
import type { ApiTokenContent } from "./apiToken";

/**
 * API トークンの保存先。トークンはハッシュだけを保存する。
 * 実装は `../infrastructure/apiTokenRepository.ts`
 */
export interface ApiTokenRepository {
  /** トークンを追加し、ID を返す */
  add(userId: string, content: ApiTokenContent): Promise<string>;
  /** 許可する範囲を変える。ユーザーのトークンが見つからなければ false */
  updatePermissions(
    userId: string,
    id: string,
    permissions: AccessPermissions,
  ): Promise<boolean>;
  /** トークンと、そのアクセス履歴を削除する。ユーザーのトークンが見つからなければ false */
  remove(userId: string, id: string): Promise<boolean>;
}
