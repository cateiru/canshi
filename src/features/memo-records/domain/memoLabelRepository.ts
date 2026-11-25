import type { MemoLabel, MemoLabelContent } from "./memoLabel";

/**
 * メモのラベルの保存先。書き込みは、ユーザーがラベルの家のメンバーであることを
 * 同じ文の中で確かめる（確認から書き込みまでの間に家から外された場合に、書き込みが通らないようにするため）。
 * 実装は `../infrastructure/memoLabelRepository.ts`
 */
export interface MemoLabelRepository {
  /** ユーザーが所属する家のラベルであれば返す */
  findForMember(userId: string, id: string): Promise<MemoLabel | null>;
  /** ユーザーが所属する家の、名前が一致するラベルであれば返す */
  findByNameForMember(
    userId: string,
    householdId: string,
    name: string,
  ): Promise<MemoLabel | null>;
  /** 家にラベルを追加し、その ID を返す。ユーザーが家のメンバーでない・同じ名前のラベルがあれば null */
  addForMember(
    userId: string,
    householdId: string,
    content: MemoLabelContent,
  ): Promise<string | null>;
  /** ラベルを書き換える。ユーザーが家のメンバーでない・見つからない・同じ名前の別のラベルがあれば false */
  updateForMember(
    userId: string,
    id: string,
    content: MemoLabelContent,
  ): Promise<boolean>;
  /**
   * メモに付いていないラベルを削除する。ユーザーが家のメンバーでない・見つからない・
   * 削除していないメモに付いていれば false
   */
  removeUnusedForMember(userId: string, id: string): Promise<boolean>;
}
