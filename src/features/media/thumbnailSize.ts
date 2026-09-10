/**
 * サムネイルの寸法計算。ブラウザ側（縮小して送信）と Workers 側（512px の WebP 化）で共用する。
 * photon の WASM を読み込まないよう `thumbnail.ts` から分離している
 */

/** Workers 側で生成する最終サムネイルの長辺（px） */
export const THUMBNAIL_MAX_EDGE = 512;

/**
 * ブラウザ側で縮小して送るサムネイル候補の長辺（px）。
 * Workers は元画像をデコードせずこの画像だけを処理するため、メモリ上限（128 MB）内で高解像度写真を扱える。
 * 最終サムネイルの 2 倍にしておき、Workers 側の縮小で画質を保つ
 */
export const CLIENT_THUMBNAIL_MAX_EDGE = 1024;

/**
 * Workers 側でデコードを許す画素数の上限。photon は画像を RGBA（4 バイト/画素）に展開し、
 * 回転・縮小でさらにコピーを作るため、これを超える画像はデコードせずに拒否する
 */
export const MAX_DECODE_PIXELS = 4_000_000;

/**
 * 長辺が maxEdge に収まるよう、アスペクト比を保ったサムネイルの寸法を計算する。
 * 元画像が maxEdge 以下ならそのままの寸法を返す
 */
export function calculateThumbnailSize(
  width: number,
  height: number,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
