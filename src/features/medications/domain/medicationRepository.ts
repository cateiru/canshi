import type { RecordActor } from "@/db/schema";
import type { MedicationContent } from "./medication";

/**
 * 服薬予定の保存先。どの操作も猫（`catId`）で絞り、別の猫の服薬予定には触れない。
 * 実装は `../infrastructure/medicationRepository.ts`
 */
export interface MedicationRepository {
  /** 猫の服薬予定があるか */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /**
   * 服薬予定を追加し、その ID を返す。関連する症状・通院記録がこの猫のもので削除されていなければ
   * 追加し、そうでなければ null
   */
  add(
    catId: string,
    content: MedicationContent,
    actor: RecordActor,
  ): Promise<string | null>;
  /**
   * 服薬予定を書き換える。見つからない・削除済み、または関連する症状・通院記録がこの猫のもので
   * 削除されていなければ書き換えず false
   */
  update(
    catId: string,
    id: string,
    content: MedicationContent,
    actor: RecordActor,
  ): Promise<boolean>;
  /** 服薬予定を、投薬実績ごと論理削除する */
  remove(catId: string, id: string, actor: RecordActor): Promise<void>;
  /** 服薬歴へ移した日時を設定する。null なら服薬予定に戻す */
  setArchivedAt(
    catId: string,
    id: string,
    archivedAt: Date | null,
    actor: RecordActor,
  ): Promise<void>;
}
