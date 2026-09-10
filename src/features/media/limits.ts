import type { MediaKind } from "./mimeSniff";

/**
 * アップロード・保存容量の上限。
 * 既定値は暫定値（docs/plans/16・18）。環境変数で上書きできる。
 */
export type MediaLimits = {
  /** 1 ファイルあたりの画像の上限（バイト） */
  maxImageBytes: number;
  /** 1 ファイルあたりの動画の上限（バイト） */
  maxVideoBytes: number;
  /** 元データ＋サムネイルの合計保存容量の上限（バイト） */
  storageLimitBytes: number;
};

export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  storageLimitBytes: 10 * 1024 * 1024 * 1024,
};

export const MEDIA_LIMIT_ENV_KEYS = {
  maxImageBytes: "MEDIA_MAX_IMAGE_BYTES",
  maxVideoBytes: "MEDIA_MAX_VIDEO_BYTES",
  storageLimitBytes: "MEDIA_STORAGE_LIMIT_BYTES",
} as const;

function parsePositiveInt(value: string | undefined): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * 環境変数から上限値を解決する。未設定・不正な値は既定値にフォールバックする。
 * Workers では `nodejs_compat` により `[vars]` が `process.env` に反映される。
 */
export function resolveMediaLimits(
  env: Record<string, string | undefined> = process.env,
): MediaLimits {
  return {
    maxImageBytes:
      parsePositiveInt(env[MEDIA_LIMIT_ENV_KEYS.maxImageBytes]) ??
      DEFAULT_MEDIA_LIMITS.maxImageBytes,
    maxVideoBytes:
      parsePositiveInt(env[MEDIA_LIMIT_ENV_KEYS.maxVideoBytes]) ??
      DEFAULT_MEDIA_LIMITS.maxVideoBytes,
    storageLimitBytes:
      parsePositiveInt(env[MEDIA_LIMIT_ENV_KEYS.storageLimitBytes]) ??
      DEFAULT_MEDIA_LIMITS.storageLimitBytes,
  };
}

export function maxBytesForKind(kind: MediaKind, limits: MediaLimits) {
  return kind === "video" ? limits.maxVideoBytes : limits.maxImageBytes;
}

/** 1 ファイルあたりの上限内かどうか */
export function isWithinFileLimit(
  kind: MediaKind,
  sizeBytes: number,
  limits: MediaLimits,
) {
  return sizeBytes <= maxBytesForKind(kind, limits);
}

/** 追加後の合計が保存容量の上限内に収まるかどうか */
export function hasStorageCapacity(
  usedBytes: number,
  additionalBytes: number,
  limits: MediaLimits,
) {
  return usedBytes + additionalBytes <= limits.storageLimitBytes;
}

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** 上限値をエラーメッセージ用に "10 MB" のような文字列にする */
export function formatBytes(bytes: number) {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${rounded} ${UNITS[unitIndex]}`;
}
