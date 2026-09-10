/**
 * D1 の 1 クエリあたりのバインドパラメーター上限。
 * `inArray` などで可変長の値を渡すクエリは、この上限を超えないよう分割して実行する
 * @see https://developers.cloudflare.com/d1/platform/limits/
 */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** 配列を `size` 件ずつに分割する */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`chunk size must be a positive integer: ${size}`);
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * `inArray` に渡す値の一覧を D1 のバインドパラメーター上限内に収まるよう分割する。
 * `reservedParameters` には同じクエリで他に使うパラメーター数（`eq` の比較値や `set` の値など）を渡す
 */
export function chunkForBoundParameters<T>(
  values: readonly T[],
  reservedParameters = 0,
): T[][] {
  const size = D1_MAX_BOUND_PARAMETERS - reservedParameters;
  if (size <= 0) {
    throw new RangeError(
      `reservedParameters must be less than ${D1_MAX_BOUND_PARAMETERS}: ${reservedParameters}`,
    );
  }
  return chunk(values, size);
}
