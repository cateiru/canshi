import { and, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { type MediaAsset, mediaAssets } from "@/db/schema";
import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";
import { syncCatProfileImage } from "@/features/cats/profileImage";
import { parseMediaAssetIds } from "./formFields";
import { listMediaAssetsByRecord } from "./queries";
import { resolveMediaRecordOwner } from "./recordOwner";
import { type MediaRecordType, PENDING_MEDIA_RECORD_TYPE } from "./recordTypes";
import { deleteMediaAssetRows } from "./storage";

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

async function listPendingAssets(ids: string[]): Promise<MediaAsset[]> {
  const db = getDb();
  const rows: MediaAsset[] = [];
  for (const chunk of chunkForBoundParameters(ids, 1)) {
    rows.push(
      ...(await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.recordType, PENDING_MEDIA_RECORD_TYPE),
            inArray(mediaAssets.id, chunk),
          ),
        )),
    );
  }
  return rows;
}

export type SyncRecordMediaResult = { error?: string };

/**
 * 記録の保存時に、フォームで指定された添付の並びへ記録のメディアを揃える。
 *
 * - 下書き（先にアップロード済みのファイル）を記録に紐付ける
 * - フォームから外された既存の添付を削除する
 * - 送られた順に表示順を振り直す
 *
 * 添付欄のないフォーム（`assetIds` が null）では何もしない
 */
export async function syncRecordMedia(
  recordType: MediaRecordType,
  recordId: string,
  assetIds: string[] | null,
): Promise<SyncRecordMediaResult> {
  if (assetIds == null) {
    return {};
  }
  const owner = await resolveMediaRecordOwner(recordType, recordId);
  if (!owner) {
    return { error: "添付先の記録が見つかりませんでした" };
  }

  const current = await listMediaAssetsByRecord(recordType, recordId);
  const pending = await listPendingAssets(
    assetIds.filter((id) => !current.some((asset) => asset.id === id)),
  );
  const plan = planMediaSync({
    submittedIds: assetIds,
    currentIds: current.map((asset) => asset.id),
    pendingIds: pending.map((asset) => asset.id),
  });

  await deleteMediaAssetRows(
    current.filter((asset) => plan.remove.includes(asset.id)),
  );

  const db = getDb();
  for (const item of plan.assign) {
    await db
      .update(mediaAssets)
      .set(
        item.isPending
          ? {
              recordType,
              recordId,
              catId: owner.catId,
              sortOrder: item.sortOrder,
            }
          : { sortOrder: item.sortOrder },
      )
      .where(
        and(
          eq(mediaAssets.id, item.id),
          // 同時に別の記録へ紐付けられていないことを条件にする
          eq(
            mediaAssets.recordType,
            item.isPending ? PENDING_MEDIA_RECORD_TYPE : recordType,
          ),
        ),
      );
  }

  if (recordType === CAT_PHOTO_MEDIA_TYPE && owner.catId) {
    // 写真の追加・削除に合わせてプロフィール画像を更新する（固定中は変更しない）
    await syncCatProfileImage(owner.catId);
  }

  if (plan.missing.length > 0) {
    return {
      error: `${plan.missing.length} 件の添付が見つかりませんでした。もう一度選び直してから保存してください`,
    };
  }
  return {};
}

/**
 * Server Action から呼ぶ。フォームの添付を記録に反映し、失敗したらフォーム用のエラーメッセージを返す
 */
export async function syncRecordMediaFromForm(
  recordType: MediaRecordType,
  recordId: string,
  formData: FormData,
): Promise<string | undefined> {
  try {
    const result = await syncRecordMedia(
      recordType,
      recordId,
      parseMediaAssetIds(formData),
    );
    return result.error ? `記録は保存しましたが、${result.error}` : undefined;
  } catch (error) {
    console.error("添付の保存に失敗しました", error);
    return "記録は保存しましたが、添付を保存できませんでした。もう一度保存してください";
  }
}
