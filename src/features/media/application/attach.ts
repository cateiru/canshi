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
  // 必要があり、全記録の添付にかかわる設計の変更になるため見送っている（PR #257 のレビューを参照）
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

  await deleteMediaAssetRows(
    current.filter((asset) => plan.remove.includes(asset.id)),
  );

  await repository.assign(
    recordType,
    recordId,
    owner.catId,
    plan.assign,
    userId,
  );

  if (plan.missing.length > 0) {
    return {
      error: `${plan.missing.length} 件の添付が見つかりませんでした。もう一度選び直してから保存してください`,
    };
  }
  return {};
}
