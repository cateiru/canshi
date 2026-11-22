import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeZip, predictLength } from "client-zip";
import { formatCsv } from "../domain/csv";
import type { RecordExportContents } from "./exportContents";

/**
 * 記録の出力で使う D1 と R2 のバインディング。省略すると `getCloudflareContext()` から取る。
 * Next.js（OpenNext）の外で動く Workflow からは、`getCloudflareContext()` を使えないため明示的に渡す
 */
export type RecordExportEnv = Pick<Env, "DB" | "MEDIA_BUCKET">;

export function getRecordExportEnv(env?: RecordExportEnv): RecordExportEnv {
  if (env) {
    return env;
  }
  const { DB, MEDIA_BUCKET } = getCloudflareContext().env;
  return { DB, MEDIA_BUCKET };
}

/**
 * R2 のマルチパートアップロードの 1 パートの大きさ。R2 は最後以外のパートを 5 MiB 以上で同じ大きさに
 * する必要がある。zip を少しずつ書き出すため、メモリに置くのはこの大きさまでにする
 */
const PART_SIZE_BYTES = 8 * 1024 * 1024;

/** R2 のマルチパートアップロードのパートの数の上限 */
const R2_MAX_UPLOAD_PARTS = 10_000;

/** zip の大きさの上限（約 78 GiB）。パートの大きさとパートの数の上限で決まる */
export const RECORD_EXPORT_MAX_BYTES = PART_SIZE_BYTES * R2_MAX_UPLOAD_PARTS;

/** zip が R2 に置ける大きさ（`RECORD_EXPORT_MAX_BYTES`）を超える */
export class RecordExportTooLargeError extends Error {
  constructor() {
    super("記録の出力の zip が大きすぎます");
    this.name = "RecordExportTooLargeError";
  }
}

/** zip に入れる CSV 1 つ分（バイト列にしたもの） */
export type RecordExportCsvBytes = { name: string; bytes: Uint8Array };

const encoder = new TextEncoder();

/** CSV をバイト列にする。zip の大きさの見積もりと書き出しで同じものを使う */
export function encodeCsvFiles(
  contents: RecordExportContents,
): RecordExportCsvBytes[] {
  return contents.csvFiles.map((file) => ({
    name: file.fileName,
    bytes: encoder.encode(formatCsv(file)),
  }));
}

/**
 * zip が R2 に置ける大きさに収まるか。zip の大きさは、写真・動画の `media_assets.size_bytes` から
 * client-zip の `predictLength` で書く前に求める（4 GiB を超える zip は ZIP64 になる）
 */
export function fitsInRecordExportArchive(
  csvFiles: RecordExportCsvBytes[],
  media: RecordExportContents["media"],
): boolean {
  const size = predictLength([
    ...csvFiles.map(({ name, bytes }) => ({ name, input: bytes })),
    ...media.map(({ path, sizeBytes }) => ({ name: path, size: sizeBytes })),
  ]);
  return size <= BigInt(RECORD_EXPORT_MAX_BYTES);
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * zip の中のファイルの日時。zip の日時はタイムゾーンを持たず、client-zip は `Date` のローカル時刻の
 * 値を書くため、実行環境のタイムゾーン（Workers は UTC、next dev は端末による）によらず日本時間の
 * 数字になるよう、日本時間の年月日・時刻をローカル時刻として持つ `Date` にする
 */
function jstWallClock(date: Date): Date {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return new Date(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate(),
    jst.getUTCHours(),
    jst.getUTCMinutes(),
    jst.getUTCSeconds(),
  );
}

/**
 * CSV と写真・動画を zip にまとめ（client-zip、圧縮しない）、R2 の `objectKey` にマルチパートアップロードで
 * 少しずつ書き出す。zip 全体の大きさ（バイト）を返す。失敗したときはアップロードを取り消して例外にする
 * （R2 に置ける大きさを超えるときは `RecordExportTooLargeError`）。
 *
 * - 写真・動画は、zip に書く順に 1 つずつ R2 から読み、そのまま流し込む（client-zip は前のファイルを
 *   書き終えてから次を取り出す）
 * - R2 に見つからない写真・動画（行だけが残っているもの）は入れずに続ける
 * - zip の中のファイルの日時は `requestedAt`（依頼した日時）の日本時間にする
 */
export async function writeRecordExportArchive(
  env: RecordExportEnv,
  objectKey: string,
  csvFiles: RecordExportCsvBytes[],
  media: RecordExportContents["media"],
  requestedAt: Date,
): Promise<number> {
  const bucket = env.MEDIA_BUCKET;
  const lastModified = jstWallClock(requestedAt);

  async function* entries() {
    for (const file of csvFiles) {
      yield { name: file.name, input: file.bytes, lastModified };
    }
    for (const entry of media) {
      const object = await bucket.get(entry.objectKey);
      if (!object) {
        console.warn(
          `記録の出力で、R2 に見つからない写真・動画を飛ばしました（${entry.objectKey}）`,
        );
        continue;
      }
      yield {
        name: entry.path,
        input: object.body,
        size: object.size,
        lastModified,
      };
    }
  }

  const upload = await bucket.createMultipartUpload(objectKey, {
    httpMetadata: { contentType: "application/zip" },
  });
  const parts: R2UploadedPart[] = [];
  let buffer = new Uint8Array(PART_SIZE_BYTES);
  let filled = 0;

  const flush = async () => {
    if (parts.length >= R2_MAX_UPLOAD_PARTS) {
      throw new RecordExportTooLargeError();
    }
    parts.push(
      await upload.uploadPart(parts.length + 1, buffer.subarray(0, filled)),
    );
    buffer = new Uint8Array(PART_SIZE_BYTES);
    filled = 0;
  };

  const reader = makeZip(entries()).getReader();
  let sizeBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      sizeBytes += value.byteLength;
      let position = 0;
      while (position < value.byteLength) {
        const length = Math.min(
          PART_SIZE_BYTES - filled,
          value.byteLength - position,
        );
        buffer.set(value.subarray(position, position + length), filled);
        filled += length;
        position += length;
        if (filled === PART_SIZE_BYTES) {
          await flush();
        }
      }
    }
    // 最後のパートは 5 MiB 未満でよい。空の zip はないが、パートが 1 つもないと完了できないため必ず送る
    if (filled > 0 || parts.length === 0) {
      await flush();
    }
    await upload.complete(parts);
    return sizeBytes;
  } catch (error) {
    // 読みかけの写真・動画があれば読むのをやめる
    await reader.cancel(error).catch(() => {});
    await upload.abort().catch(() => {});
    throw error;
  }
}

/** R2 の `delete` に 1 回で渡せるキーの数の上限 */
const R2_MAX_DELETE_KEYS = 1000;

/** R2 に置いた zip を消す。存在しないキーの削除は何もしない */
export async function deleteRecordExportObjects(
  objectKeys: string[],
  env?: RecordExportEnv,
): Promise<void> {
  if (objectKeys.length === 0) {
    return;
  }
  const bucket = getRecordExportEnv(env).MEDIA_BUCKET;
  for (let i = 0; i < objectKeys.length; i += R2_MAX_DELETE_KEYS) {
    await bucket.delete(objectKeys.slice(i, i + R2_MAX_DELETE_KEYS));
  }
}

/** ダウンロードのために、R2 に置いた zip を読む。なければ null */
export async function getRecordExportObject(
  objectKey: string,
): Promise<R2ObjectBody | null> {
  return getRecordExportEnv().MEDIA_BUCKET.get(objectKey);
}
