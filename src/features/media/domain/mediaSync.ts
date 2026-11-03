/*
 * 記録の添付を、フォームで指定された並びに揃えるための計画（`syncRecordMedia`）
 */

export type MediaSyncPlan = {
  /** 送られた順に付け替える行（既存・下書きとも）と、その表示順 */
  assign: { id: string; sortOrder: number; isPending: boolean }[];
  /** フォームから外された既存の添付 */
  remove: string[];
  /** 見つからない ID（期限切れで削除された下書きなど）や、他の記録の添付の ID */
  missing: string[];
};

/**
 * 送られた ID の並びと、記録に紐付く既存の添付・下書きから、付け替え・削除の内容を決める。
 * 他の記録に紐付いた添付の ID が送られても付け替えない（任意の ID で他の記録の添付を奪えないようにする）
 */
export function planMediaSync({
  submittedIds,
  currentIds,
  pendingIds,
}: {
  submittedIds: string[];
  currentIds: string[];
  pendingIds: string[];
}): MediaSyncPlan {
  const assign: MediaSyncPlan["assign"] = [];
  const missing: string[] = [];
  for (const id of submittedIds) {
    if (currentIds.includes(id)) {
      assign.push({ id, sortOrder: assign.length, isPending: false });
    } else if (pendingIds.includes(id)) {
      assign.push({ id, sortOrder: assign.length, isPending: true });
    } else {
      missing.push(id);
    }
  }
  const remove = currentIds.filter((id) => !submittedIds.includes(id));
  return { assign, remove, missing };
}
