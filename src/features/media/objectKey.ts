/**
 * R2 のオブジェクトキー命名規則。
 * `{recordType}/{recordId}/{assetId}` を元データ、`{recordType}/{recordId}/{assetId}.thumb.webp` をサムネイルとする。
 * レコード単位でプレフィックスが揃うため、記録削除時に `list({ prefix })` でまとめて扱える。
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
