import type { FeedingPresetContent } from "./feedingPreset";

/**
 * ごはんプリセットの保存先。書き込みは、ユーザーがプリセットの家のメンバーであることを
 * 同じ文の中で確かめる（確認から書き込みまでの間に家から外された場合に、書き込みが通らないようにするため）。
 * 実装は `../infrastructure/feedingPresetRepository.ts`
 */
export interface FeedingPresetRepository {
  /** ユーザーが所属する家のプリセットであれば、その家の ID を返す */
  findHouseholdIdForMember(userId: string, id: string): Promise<string | null>;
  /** 家にプリセットを明細ごと追加し、その ID を返す。ユーザーが家のメンバーでなければ null */
  addForMember(
    userId: string,
    householdId: string,
    content: FeedingPresetContent,
  ): Promise<string | null>;
  /** プリセットを書き換え、明細を入れ直す。ユーザーが家のメンバーでない・見つからなければ false */
  updateForMember(
    userId: string,
    householdId: string,
    id: string,
    content: FeedingPresetContent,
  ): Promise<boolean>;
  /** プリセットを明細ごと削除する */
  removeForMember(
    userId: string,
    householdId: string,
    id: string,
  ): Promise<void>;
}
