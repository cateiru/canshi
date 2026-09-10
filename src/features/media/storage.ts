import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { chunk, chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { type MediaAsset, mediaAssets } from "@/db/schema";
import {
  detachProfileImages,
  syncCatProfileImage,
} from "@/features/cats/profileImage";
import { type ExifOrientation, sanitizeImage } from "./exif";
import { orientedDimensions, parseImageDimensions } from "./imageDimensions";
import {
  formatBytes,
  hasStorageCapacity,
  isWithinFileLimit,
  maxBytesForKind,
  resolveMediaLimits,
} from "./limits";
import {
  SNIFF_HEAD_BYTES,
  type SniffedMediaType,
  type SupportedImageMimeType,
  sniffMediaType,
  THUMBNAIL_MIME_TYPE,
} from "./mimeSniff";
import { buildObjectKey, buildThumbnailObjectKey } from "./objectKey";
import { nextMediaSortOrder, sumMediaStorageBytes } from "./queries";
import { generateImageThumbnail } from "./thumbnail";
import { MAX_DECODE_PIXELS } from "./thumbnailSize";

/**
 * R2 と `media_assets` を扱う共通処理。
 * アップロード API・各記録の削除アクションはこのモジュールを通して R2 を操作する
 */

/** R2 の 1 回の delete で渡せるキー数の上限 */
const R2_MAX_DELETE_KEYS = 1000;

export class MediaUploadError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MediaUploadError";
    this.status = status;
  }
}

export type StoreMediaAssetInput = {
  recordType: string;
  recordId: string;
  catId: string | null;
  /** アップロードされたファイル本体 */
  file: Blob;
  /**
   * ブラウザ側で縮小したサムネイル候補の画像。
   * 動画は Workers 側でデコードしないため必須。画像は任意だが、これがない場合は
   * `MAX_DECODE_PIXELS` 以下の画像しか Workers 側でデコードしない（メモリ上限対策）
   */
  thumbnail?: Blob | null;
};

function getBucket(): R2Bucket {
  const { env } = getCloudflareContext();
  return env.MEDIA_BUCKET;
}

async function readHead(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, SNIFF_HEAD_BYTES).arrayBuffer());
}

async function sniffBlob(blob: Blob): Promise<SniffedMediaType | null> {
  return sniffMediaType(await readHead(blob));
}

type PreparedOriginal = {
  body: Uint8Array | Blob;
  sizeBytes: number;
  thumbnail: Uint8Array;
  width: number;
  height: number;
};

type DecodedThumbnail = {
  bytes: Uint8Array;
  /** 回転補正後の入力画像の寸法 */
  sourceWidth: number;
  sourceHeight: number;
};

/**
 * 画像をデコードして 512px の WebP サムネイルを作る。
 * photon は画像全体を RGBA に展開するため、ヘッダーの寸法が `MAX_DECODE_PIXELS` を超える
 * 画像はデコードせずに拒否する（Workers のメモリ上限を超えてクラッシュするのを防ぐ）
 */
function decodeThumbnail(
  bytes: Uint8Array,
  mimeType: SupportedImageMimeType,
  orientation: ExifOrientation,
  tooLargeMessage: string,
): DecodedThumbnail {
  const dimensions = parseImageDimensions(bytes, mimeType);
  if (!dimensions) {
    throw new MediaUploadError("画像を読み込めませんでした");
  }
  if (dimensions.width * dimensions.height > MAX_DECODE_PIXELS) {
    throw new MediaUploadError(tooLargeMessage);
  }
  try {
    const thumbnail = generateImageThumbnail(bytes, orientation);
    return {
      bytes: thumbnail.bytes,
      sourceWidth: thumbnail.sourceWidth,
      sourceHeight: thumbnail.sourceHeight,
    };
  } catch {
    throw new MediaUploadError("画像を読み込めませんでした");
  }
}

/**
 * ブラウザ側で縮小したサムネイル候補を検証し、元画像と同じ経路（メタデータ除去・512px 化）でサムネイルにする
 */
async function prepareThumbnailSource(
  thumbnailSource: Blob,
): Promise<DecodedThumbnail> {
  const sniffed = await sniffBlob(thumbnailSource);
  if (sniffed?.kind !== "image") {
    throw new MediaUploadError("サムネイルが画像ではありません");
  }
  const { bytes, orientation } = sanitizeImage(
    new Uint8Array(await thumbnailSource.arrayBuffer()),
    sniffed.mimeType,
  );
  return decodeThumbnail(
    bytes,
    sniffed.mimeType,
    orientation,
    "サムネイル画像が大きすぎます",
  );
}

async function prepareImage(
  file: Blob,
  mimeType: SupportedImageMimeType,
  thumbnailSource: Blob | null | undefined,
): Promise<PreparedOriginal> {
  const original = new Uint8Array(await file.arrayBuffer());
  const { bytes, orientation } = sanitizeImage(original, mimeType);
  // 元画像の寸法はデコードせずヘッダーから読む（Orientation による 90 度回転を反映する）
  const dimensions = parseImageDimensions(bytes, mimeType);
  if (!dimensions) {
    throw new MediaUploadError("画像を読み込めませんでした");
  }
  const oriented = orientedDimensions(dimensions, orientation);

  // ブラウザ側で縮小した候補があればそれだけをデコードし、元画像はデコードしない。
  // ない場合（古いクライアントやブラウザで縮小に失敗した場合）は小さい画像に限って Workers 側で生成する
  const thumbnail =
    thumbnailSource && thumbnailSource.size > 0
      ? await prepareThumbnailSource(thumbnailSource)
      : decodeThumbnail(
          bytes,
          mimeType,
          orientation,
          "画像が大きすぎるためサムネイルを作成できませんでした。もう一度お試しください",
        );
  return {
    body: bytes,
    sizeBytes: bytes.byteLength,
    thumbnail: thumbnail.bytes,
    width: oriented.width,
    height: oriented.height,
  };
}

async function prepareVideo(
  file: Blob,
  thumbnailSource: Blob | null | undefined,
): Promise<PreparedOriginal> {
  if (!thumbnailSource || thumbnailSource.size === 0) {
    throw new MediaUploadError("動画にはサムネイル画像を添えてください");
  }
  const thumbnail = await prepareThumbnailSource(thumbnailSource);
  return {
    // 動画はメモリ上にコピーを作らず Blob のまま R2 に渡す
    body: file,
    sizeBytes: file.size,
    thumbnail: thumbnail.bytes,
    // 動画の寸法は記録できないため、サムネイル（縮小済みフレーム）の寸法を表示レイアウト用に使う
    width: thumbnail.sourceWidth,
    height: thumbnail.sourceHeight,
  };
}

/**
 * ファイルを検証・加工して R2 に保存し、`media_assets` 行を作成する。
 * 検証エラーは MediaUploadError として投げる
 */
export async function storeMediaAsset(
  input: StoreMediaAssetInput,
): Promise<MediaAsset> {
  const { recordType, recordId, catId, file } = input;
  if (file.size === 0) {
    throw new MediaUploadError("ファイルが空です");
  }

  const limits = resolveMediaLimits();
  const sniffed = await sniffBlob(file);
  if (!sniffed) {
    throw new MediaUploadError(
      "対応していない形式です（画像は JPEG／PNG／WebP／GIF、動画は MP4／WebM／MOV）",
      415,
    );
  }
  if (!isWithinFileLimit(sniffed.kind, file.size, limits)) {
    throw new MediaUploadError(
      `${sniffed.kind === "video" ? "動画" : "画像"}は ${formatBytes(
        maxBytesForKind(sniffed.kind, limits),
      )} 以下にしてください`,
      413,
    );
  }

  const prepared =
    sniffed.kind === "image"
      ? await prepareImage(file, sniffed.mimeType, input.thumbnail)
      : await prepareVideo(file, input.thumbnail);

  const usedBytes = await sumMediaStorageBytes();
  const additionalBytes = prepared.sizeBytes + prepared.thumbnail.byteLength;
  if (!hasStorageCapacity(usedBytes, additionalBytes, limits)) {
    throw new MediaUploadError(
      `保存容量の上限（${formatBytes(limits.storageLimitBytes)}）を超えるためアップロードできません`,
      507,
    );
  }

  const assetId = crypto.randomUUID();
  const objectKey = buildObjectKey(recordType, recordId, assetId);
  const thumbnailObjectKey = buildThumbnailObjectKey(
    recordType,
    recordId,
    assetId,
  );
  const bucket = getBucket();

  try {
    // 片方の put だけ成功した場合も catch で両方のキーを片付けるため、両方が完了するまで待つ
    // （Promise.all だと先に失敗した時点で抜けてしまい、進行中の put が後から残る）
    const putResults = await Promise.allSettled([
      bucket.put(objectKey, prepared.body, {
        httpMetadata: { contentType: sniffed.mimeType },
      }),
      bucket.put(thumbnailObjectKey, prepared.thumbnail, {
        httpMetadata: { contentType: THUMBNAIL_MIME_TYPE },
      }),
    ]);
    for (const result of putResults) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }

    const db = getDb();
    const sortOrder = await nextMediaSortOrder(recordType, recordId);
    const [created] = await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        catId,
        recordType,
        recordId,
        objectKey,
        thumbnailObjectKey,
        mimeType: sniffed.mimeType,
        sizeBytes: prepared.sizeBytes,
        thumbnailSizeBytes: prepared.thumbnail.byteLength,
        width: prepared.width,
        height: prepared.height,
        sortOrder,
      })
      .returning();
    return created;
  } catch (error) {
    // R2 への保存が一部失敗した場合や行の作成に失敗した場合は、R2 に置いたオブジェクトを片付ける
    // （存在しないキーの削除は何もしないので、両方まとめて消してよい。失敗しても元のエラーを優先する）
    await bucket.delete([objectKey, thumbnailObjectKey]).catch(() => {});
    throw error;
  }
}

function objectKeysOf(
  assets: Pick<MediaAsset, "objectKey" | "thumbnailObjectKey">[],
) {
  const keys: string[] = [];
  for (const asset of assets) {
    keys.push(asset.objectKey);
    if (asset.thumbnailObjectKey) {
      keys.push(asset.thumbnailObjectKey);
    }
  }
  return keys;
}

/**
 * 指定した行の R2 オブジェクトと `media_assets` 行を削除する。
 * R2 の削除に失敗した場合は行を残して例外を投げる（行だけ消えて参照先のない状態を避ける）
 */
async function deleteAssets(assets: MediaAsset[]): Promise<void> {
  if (assets.length === 0) {
    return;
  }
  const bucket = getBucket();
  for (const keys of chunk(objectKeysOf(assets), R2_MAX_DELETE_KEYS)) {
    await bucket.delete(keys);
  }
  const db = getDb();
  const assetIds = assets.map((asset) => asset.id);
  // cats.profile_media_asset_id から参照されている行は先に参照を外す（外部キー制約）
  const affectedCatIds = await detachProfileImages(assetIds);
  // D1 のバインドパラメーター上限を超えないよう分割して削除する
  for (const ids of chunkForBoundParameters(assetIds)) {
    await db.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
  }
  // プロフィールに使っていた写真が消えた猫は、残りの写真から選び直す
  for (const catId of affectedCatIds) {
    await syncCatProfileImage(catId);
  }
}

/** 1 件削除。存在しない場合は何もしない */
export async function deleteMediaAsset(assetId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  await deleteAssets(rows);
}

/**
 * 指定した猫に紐付くすべてのメディアを削除する。猫の削除時に呼ぶ
 */
export async function deleteMediaAssetsByCat(catId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.catId, catId));
  await deleteAssets(rows);
}

/**
 * 指定レコードに紐付くメディアをまとめて削除する。
 * 各記録の削除アクションは、レコード本体を削除する前にこの関数を呼ぶ
 */
export async function deleteMediaAssetsByRecord(
  recordType: string,
  recordId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, recordType),
        eq(mediaAssets.recordId, recordId),
      ),
    );
  await deleteAssets(rows);
}
