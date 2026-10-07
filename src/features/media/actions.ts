"use server";

import { requireUser } from "@/features/auth/session";
import { canDeleteMediaAsset } from "./access";
import { getMediaAssetById } from "./queries";
import { deleteMediaAsset, deletePendingMediaAsset } from "./storage";

export type DeleteMediaAssetResult = { error?: string };

/**
 * 添付 UI から個別のメディアを削除するための Server Action。
 * 結果は戻り値で返し、呼び出し側が画面を更新する
 */
export async function deleteMediaAssetAction(
  assetId: string,
): Promise<DeleteMediaAssetResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    const asset = await getMediaAssetById(assetId);
    if (!asset || !(await canDeleteMediaAsset(user.id, asset))) {
      return { error: "メディアが見つかりませんでした" };
    }
    await deleteMediaAsset(assetId);
    return {};
  } catch (error) {
    console.error("メディアの削除に失敗しました", error);
    return { error: "メディアの削除に失敗しました" };
  }
}

/**
 * フォームで選んだファイル（記録に紐付く前の下書き）を、保存前に取り消したときに削除する。
 * 記録に紐付いた添付は削除しない
 */
export async function discardPendingMediaAction(
  assetId: string,
): Promise<DeleteMediaAssetResult> {
  const user = await requireUser();
  try {
    await deletePendingMediaAsset(assetId, user.id);
    return {};
  } catch (error) {
    console.error("下書きの削除に失敗しました", error);
    return { error: "メディアの削除に失敗しました" };
  }
}
