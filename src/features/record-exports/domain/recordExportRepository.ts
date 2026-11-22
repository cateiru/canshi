import type { RecordExport, RecordExportFailureReason } from "@/db/schema";
import type { RecordExportType } from "./recordExport";

/** 新しく依頼する出力の内容 */
export type NewRecordExportRequest = {
  recordTypes: RecordExportType[];
  includeMedia: boolean;
};

/**
 * 記録の出力の保存先。実装は `../infrastructure/recordExportRepository.ts`。
 * 家のメンバーであること・処理中の出力がないことは、書き込みの文の中で確かめる
 */
export interface RecordExportRepository {
  /**
   * 出力を依頼する（`pending` の行を作る）。家のメンバーでない、または処理中の出力がすでにあれば
   * 何もせずに null。処理中のまま `staleBefore` より前に作られた出力は、同じ batch で失敗にしてから作る
   */
  addForMember(
    householdId: string,
    userId: string,
    request: NewRecordExportRequest,
    staleBefore: Date,
  ): Promise<string | null>;
  /** バッチが処理を始めた。処理中（`pending`・`processing`）の出力だけを `processing` にし、その行を返す */
  markProcessing(recordExportId: string): Promise<RecordExport | null>;
  /** zip を作り終えた。`processing` の出力だけを `completed` にする。そうでなければ false */
  markCompleted(
    recordExportId: string,
    objectKey: string,
    sizeBytes: number,
  ): Promise<boolean>;
  /** 出力できなかった。処理中の出力だけを `failed` にする */
  markFailed(
    recordExportId: string,
    reason: RecordExportFailureReason,
  ): Promise<void>;
  /**
   * 処理中でない出力を削除する。処理中のまま `staleBefore` より前に作られた出力（止まったもの）も
   * 削除できる。家のメンバーでない・処理中・見つからなければ何もせずに null。
   * 削除できたら、R2 から消すために zip のオブジェクトキー（作れていなければ null）を返す
   */
  removeForMember(
    householdId: string,
    userId: string,
    recordExportId: string,
    staleBefore: Date,
  ): Promise<{ objectKey: string | null } | null>;
}
