import type { RecordActor } from "@/db/schema";
import type { MemoRecordContent } from "./memoRecord";

/**
 * メモの記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/memoRecordRepository.ts`
 */
export interface MemoRecordRepository {
  /** 記録をラベルごと（まだないラベルは作って）追加し、その ID を返す。猫がメモリーへ移されていれば追加せず null */
  add(
    catId: string,
    content: MemoRecordContent,
    actor: RecordActor,
  ): Promise<string | null>;
  /** 記録を書き換え、ラベルを（まだないラベルは作って）付け直す。見つからない・猫がメモリーへ移されていれば false */
  update(
    catId: string,
    id: string,
    content: MemoRecordContent,
    actor: RecordActor,
  ): Promise<boolean>;
  /** 記録を論理削除する（削除日時を入れる）。見つからない・削除済み・猫がメモリーへ移されていれば false */
  remove(catId: string, id: string, actor: RecordActor): Promise<boolean>;
}
