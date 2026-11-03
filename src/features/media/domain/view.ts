import type { MediaAsset } from "@/db/schema";
import { type MediaKind, mediaKindOf } from "./mimeSniff";

/**
 * クライアントコンポーネントや API レスポンスに渡す、メディアの表示用情報。
 * DB の行（オブジェクトキーなどの内部情報）を直接クライアントに渡さないための型
 */
export type MediaAssetView = {
  id: string;
  recordType: string;
  recordId: string;
  catId: string | null;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  /** 元データの配信 URL */
  url: string;
  /** サムネイルの配信 URL */
  thumbnailUrl: string;
};

export function mediaUrl(assetId: string) {
  return `/media/${assetId}`;
}

export function mediaThumbnailUrl(assetId: string) {
  return `/media/${assetId}/thumbnail`;
}

export function toMediaAssetView(asset: MediaAsset): MediaAssetView {
  return {
    id: asset.id,
    recordType: asset.recordType,
    recordId: asset.recordId,
    catId: asset.catId,
    mimeType: asset.mimeType,
    kind: mediaKindOf(asset.mimeType),
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    sortOrder: asset.sortOrder,
    url: mediaUrl(asset.id),
    thumbnailUrl: mediaThumbnailUrl(asset.id),
  };
}
