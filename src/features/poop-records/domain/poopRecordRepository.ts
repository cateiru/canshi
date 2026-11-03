import type { PoopRecordContent } from "./poopRecord";

/**
 * うんちの記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/poopRecordRepository.ts`
 */
export interface PoopRecordRepository {
  /** 猫の記録があるか。添付は記録 ID だけで消すため、消す前にこの猫の記録かを確かめるのに使う */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /** 記録を追加し、その ID を返す */
  add(catId: string, content: PoopRecordContent): Promise<string>;
  /** 記録を書き換える。見つからなければ false */
  update(
    catId: string,
    id: string,
    content: PoopRecordContent,
  ): Promise<boolean>;
  /** 記録を削除する。見つからなければ false */
  remove(catId: string, id: string): Promise<boolean>;
}
