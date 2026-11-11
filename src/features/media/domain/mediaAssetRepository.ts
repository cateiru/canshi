import type { MediaAsset } from "@/db/schema";
import type { MediaSyncPlan } from "./mediaSync";
import type { MediaRecordType } from "./recordTypes";

/**
 * 添付（`media_assets` の行）の保存先。R2 のオブジェクトの削除は `../infrastructure/storage.ts` で行う。
 * 実装は `../infrastructure/mediaAssetRepository.ts`
 */
export interface MediaAssetRepository {
  /** 指定した ID のうち、`userId` がアップロードした下書きだけを読む */
  listPendingForUser(ids: string[], userId: string): Promise<MediaAsset[]>;
  /**
   * 添付を記録に紐付け、表示順を振り直す。下書きは同時に別の記録へ紐付けられていない
   * （`userId` がアップロードした下書きのままの）ときだけ紐付ける。
   * 記録が削除されている（論理削除を含む）ときは何も変えない。紐付け・振り直しができた行の ID を返す
   */
  assign(
    recordType: MediaRecordType,
    recordId: string,
    catId: string | null,
    items: MediaSyncPlan["assign"],
    userId: string,
  ): Promise<string[]>;
}
