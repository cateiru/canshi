import { planMediaSync } from "../domain/mediaSync";
import type { MediaRecordType } from "../domain/recordTypes";
import { createMediaAssetRepository } from "../infrastructure/mediaAssetRepository";
import { listMediaAssetsByRecord } from "../infrastructure/queries";
import { resolveMediaRecordOwner } from "../infrastructure/recordOwner";
import { deleteMediaAssetRows } from "../infrastructure/storage";
import { canAccessMediaRecordOwner } from "./access";

export type SyncRecordMediaResult = { error?: string };

/**
 * 記録の保存時に、フォームで指定された添付の並びへ記録のメディアを揃える。
 *
 * - 下書き（先にアップロード済みのファイル）を記録に紐付ける。紐付けられるのは
 *   `userId`（保存したユーザー）がアップロードした下書きだけで、それ以外は見つからない扱いにする
 * - フォームから外された既存の添付を削除する
 * - 送られた順に表示順を振り直す
 *
 * 添付欄のないフォーム（`assetIds` が null）では何もしない
 */
export async function syncRecordMedia(
  recordType: MediaRecordType,
  recordId: string,
  assetIds: string[] | null,
  userId: string,
): Promise<SyncRecordMediaResult> {
  if (assetIds == null) {
    return {};
  }
  const owner = await resolveMediaRecordOwner(recordType, recordId);
  // 呼び出し元の Server Action で認可済みでも、記録の保存の後に家から外された場合に添付を
  // 削除・付け替えできないよう、添付を書き換える直前にもう一度確かめる。
  // ただし、この確認から下の R2・D1 の書き込みまでの間に家から外された場合は防げない
  // （R2 の削除は D1 の文やトランザクションに含められないため）。完全に防ぐには、`media_assets` の
  // 更新・削除の WHERE に所属の条件を含め、R2 は行を論理削除してから非同期で掃除する方式にする
  // 必要があり、全記録の添付にかかわる設計の変更になるため見送っている（PR #257 のレビューを参照）。
  // 記録が論理削除された場合は、付け替えの文（`assign`）の中で記録が削除されずにあることを確かめ、
  // 削除済みの記録へは添付しない
  if (!owner || !(await canAccessMediaRecordOwner(userId, owner))) {
    return { error: "添付先の記録が見つかりませんでした" };
  }

  const current = await listMediaAssetsByRecord(recordType, recordId);
  const repository = createMediaAssetRepository();
  const pending = await repository.listPendingForUser(
    assetIds.filter((id) => !current.some((asset) => asset.id === id)),
    userId,
  );
  const plan = planMediaSync({
    submittedIds: assetIds,
    currentIds: current.map((asset) => asset.id),
    pendingIds: pending.map((asset) => asset.id),
  });

  // 付け替えを先にし、記録が削除されていて付け替えられなかったときは、外された添付も削除しない
  // （削除済みの記録の添付には手を付けない）
  const assignedIds = await repository.assign(
    recordType,
    recordId,
    owner.catId,
    plan.assign,
    userId,
  );
  const unassigned = plan.assign.filter(
    (item) => !assignedIds.includes(item.id),
  );
  if (
    unassigned.length > 0 &&
    !(await resolveMediaRecordOwner(recordType, recordId))
  ) {
    return { error: "添付先の記録が見つかりませんでした" };
  }

  await deleteMediaAssetRows(
    current.filter((asset) => plan.remove.includes(asset.id)),
  );

  // 同時に別の記録へ紐付けられた下書きなど、付け替えられなかった添付も見つからない扱いにする
  const missingCount = plan.missing.length + unassigned.length;
  if (missingCount > 0) {
    return {
      error: `${missingCount} 件の添付が見つかりませんでした。もう一度選び直してから保存してください`,
    };
  }
  return {};
}
