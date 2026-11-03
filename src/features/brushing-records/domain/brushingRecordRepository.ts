import type { BrushingRecordContent } from "./brushingRecord";

/**
 * ブラッシングの記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/brushingRecordRepository.ts`
 */
export interface BrushingRecordRepository {
  /** 記録を追加し、その ID を返す */
  add(catId: string, content: BrushingRecordContent): Promise<string>;
  /** 記録を書き換える。見つからなければ false */
  update(
    catId: string,
    id: string,
    content: BrushingRecordContent,
  ): Promise<boolean>;
  /** 記録を削除する。見つからなければ false */
  remove(catId: string, id: string): Promise<boolean>;
}
