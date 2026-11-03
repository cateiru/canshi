/**
 * R2 のオブジェクトキー命名規則。
 * `{recordType}/{recordId}/{assetId}` を元データ、`{recordType}/{recordId}/{assetId}.thumb.webp` をサムネイルとする。
 * レコード単位でプレフィックスが揃うため、記録削除時に `list({ prefix })` でまとめて扱える。
 *
 * ただし、フォームで先にアップロードした下書き（`pending/{assetId}`）は、記録に紐付けた後も
 * キーを付け替えない（R2 はリネームできずコピーが必要なため）。削除は常に `media_assets` 行の
 * `objectKey` を使って行う。
 */

const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export const THUMBNAIL_KEY_SUFFIX = ".thumb.webp";

function assertSegment(name: string, value: string) {
  if (!KEY_SEGMENT_PATTERN.test(value)) {
    throw new Error(`${name} にオブジェクトキーに使えない文字が含まれています`);
  }
}

export function buildRecordPrefix(recordType: string, recordId: string) {
  assertSegment("recordType", recordType);
  assertSegment("recordId", recordId);
  return `${recordType}/${recordId}/`;
}

export function buildObjectKey(
  recordType: string,
  recordId: string,
  assetId: string,
) {
  assertSegment("assetId", assetId);
  return `${buildRecordPrefix(recordType, recordId)}${assetId}`;
}

export function buildThumbnailObjectKey(
  recordType: string,
  recordId: string,
  assetId: string,
) {
  return `${buildObjectKey(recordType, recordId, assetId)}${THUMBNAIL_KEY_SUFFIX}`;
}

/** レコードに紐付く前の下書きの置き場所 */
export const PENDING_KEY_PREFIX = "pending";

export function buildPendingObjectKey(assetId: string) {
  assertSegment("assetId", assetId);
  return `${PENDING_KEY_PREFIX}/${assetId}`;
}

export function buildPendingThumbnailObjectKey(assetId: string) {
  return `${buildPendingObjectKey(assetId)}${THUMBNAIL_KEY_SUFFIX}`;
}
