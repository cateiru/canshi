import { getCloudflareContext } from "@opennextjs/cloudflare";
import { formatCsv } from "../domain/csv";
import type { RecordExportContents } from "./exportContents";
import { crc32OfStream, ZipWriter } from "./zip";

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

/**
 * これ以下の写真・動画は、R2 から一度に読み込んで CRC を求める。大きいもの（動画）はメモリに
 * 置ききらないよう、CRC を求めるためと zip に書くために 2 回読む
 */
const IN_MEMORY_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

const encoder = new TextEncoder();

/** CSV をバイト列にする。zip の大きさの見積もりと書き出しで同じものを使う */
export function encodeCsvFiles(contents: RecordExportContents) {
  return contents.csvFiles.map((file) => ({
    name: file.fileName,
    bytes: encoder.encode(formatCsv(file)),
  }));
}

/**
 * CSV と写真・動画を zip にまとめ、R2 の `objectKey` にマルチパートアップロードで書き出す。
 * zip 全体の大きさ（バイト）を返す。失敗したときはアップロードを取り消して例外にする
 * （大きさ・ファイル数が上限を超えるときは `ZipTooLargeError`）。
 * R2 に見つからない写真・動画（行だけが残っているもの）は入れずに続ける
 */
export async function writeRecordExportArchive(
  env: RecordExportEnv,
  objectKey: string,
  csvFiles: { name: string; bytes: Uint8Array }[],
  media: RecordExportContents["media"],
  modifiedAt: Date,
): Promise<number> {
  const bucket = env.MEDIA_BUCKET;
  const upload = await bucket.createMultipartUpload(objectKey, {
    httpMetadata: { contentType: "application/zip" },
  });
  const parts: R2UploadedPart[] = [];
  let buffer = new Uint8Array(PART_SIZE_BYTES);
  let filled = 0;

  const flush = async () => {
    parts.push(
      await upload.uploadPart(parts.length + 1, buffer.subarray(0, filled)),
    );
    buffer = new Uint8Array(PART_SIZE_BYTES);
    filled = 0;
  };

  const zip = new ZipWriter(async (chunk) => {
    let position = 0;
    while (position < chunk.byteLength) {
      const length = Math.min(
        PART_SIZE_BYTES - filled,
        chunk.byteLength - position,
      );
      buffer.set(chunk.subarray(position, position + length), filled);
      filled += length;
      position += length;
      if (filled === PART_SIZE_BYTES) {
        await flush();
      }
    }
  }, modifiedAt);

  try {
    for (const file of csvFiles) {
      await zip.addFile(file.name, file.bytes);
    }
    for (const entry of media) {
      const object = await bucket.get(entry.objectKey);
      if (!object) {
        console.warn(
          `記録の出力で、R2 に見つからない写真・動画を飛ばしました（${entry.objectKey}）`,
        );
        continue;
      }
      if (object.size <= IN_MEMORY_MEDIA_MAX_BYTES) {
        await zip.addFile(
          entry.path,
          new Uint8Array(await object.arrayBuffer()),
        );
        continue;
      }
      const checksum = await crc32OfStream(object.body);
      const again = await bucket.get(entry.objectKey);
      if (!again) {
        throw new Error(`${entry.objectKey} を読み直せませんでした`);
      }
      await zip.addStream(entry.path, checksum, again.body);
    }
    const sizeBytes = await zip.finish();
    // 最後のパートは 5 MiB 未満でよい。空の zip はないが、パートが 1 つもないと完了できないため必ず送る
    if (filled > 0 || parts.length === 0) {
      await flush();
    }
    await upload.complete(parts);
    return sizeBytes;
  } catch (error) {
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
