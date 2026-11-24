import type { ApiAccessLogContent } from "./apiAccessLog";

/** API のアクセス履歴の保存先。実装は `../infrastructure/apiAccessLogRepository.ts` */
export interface ApiAccessLogRepository {
  /**
   * トークンのアクセス履歴を追加する。応答の後に記録するため、その間にトークンが削除されていたら
   * 追加しない
   */
  add(
    apiTokenId: string,
    content: ApiAccessLogContent,
    accessedAt: Date,
  ): Promise<void>;
}
