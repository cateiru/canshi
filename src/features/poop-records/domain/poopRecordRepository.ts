import type { RecordActor } from "@/db/schema";
import type { PoopRecordContent } from "./poopRecord";

/**
 * うんちの記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/poopRecordRepository.ts`
 */
export interface PoopRecordRepository {
  /** 記録を追加し、その ID を返す */
  add(
    catId: string,
    content: PoopRecordContent,
    actor: RecordActor,
  ): Promise<string>;
  /** 記録を書き換える。見つからなければ false */
  update(
    catId: string,
    id: string,
    content: PoopRecordContent,
    actor: RecordActor,
  ): Promise<boolean>;
  /** 記録を論理削除する（削除日時を入れる）。見つからない・削除済みなら false */
  remove(catId: string, id: string, actor: RecordActor): Promise<boolean>;
}
