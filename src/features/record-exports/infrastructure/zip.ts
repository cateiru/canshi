/*
 * 記録の出力の zip を少しずつ書き出す。写真・動画を読み込みきらずに R2 から流し込めるよう、
 * 圧縮はせず（STORE）、書いたバイト列を順に `sink` へ渡す。
 *
 * - どのファイルも、CRC と大きさをローカルファイルヘッダーに書く。データ記述子（汎用フラグの bit 3）は、
 *   圧縮しないファイルでは先頭から順に読んで展開するツールがファイルの終わりを見つけられないため使わない。
 *   流し込むファイルは、呼び出し側が先に CRC を求めておく
 * - ファイル名は UTF-8（汎用フラグの bit 11）
 * - ZIP64 には対応しない。大きさ・オフセットが 4 GiB、ファイル数が 65,535 を超えるなら `ZipTooLargeError`
 */

/** ZIP64 を使わずに書ける、zip 全体の大きさの上限（バイト） */
export const ZIP_MAX_BYTES = 0xffffffff;

/** ZIP64 を使わずに書ける、ファイル数の上限 */
export const ZIP_MAX_ENTRIES = 0xffff;

export class ZipTooLargeError extends Error {
  constructor() {
    super("zip の大きさかファイル数が上限を超えます");
    this.name = "ZipTooLargeError";
  }
}

export type ZipSink = (chunk: Uint8Array) => Promise<void>;

const LOCAL_FILE_HEADER_SIZE = 30;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

const VERSION = 20;
const FLAG_UTF8 = 0x0800;

const encoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 を続きから計算する。最初は `crc` に 0 を渡す */
export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
}

/** ストリームを最後まで読み、CRC-32 と大きさを返す */
export async function crc32OfStream(
  stream: ReadableStream<Uint8Array>,
): Promise<{ crc: number; sizeBytes: number }> {
  let crc = 0;
  let sizeBytes = 0;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return { crc, sizeBytes };
      }
      crc = crc32(value, crc);
      sizeBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

/** zip に入れるファイル 1 つ分の、大きさの見積もりに使う情報 */
export type ZipEntrySize = { name: string; sizeBytes: number };

/** ファイルを入れたときの zip 全体の大きさ（バイト）。中身を書く前に上限を超えるかを確かめるために使う */
export function zipSizeOf(entries: readonly ZipEntrySize[]): number {
  let size = END_OF_CENTRAL_DIRECTORY_SIZE;
  for (const entry of entries) {
    const nameLength = encoder.encode(entry.name).byteLength;
    size +=
      LOCAL_FILE_HEADER_SIZE +
      nameLength +
      entry.sizeBytes +
      CENTRAL_DIRECTORY_HEADER_SIZE +
      nameLength;
  }
  return size;
}

/** zip の大きさ・ファイル数が、ZIP64 を使わずに書ける範囲に収まるか */
export function fitsInZip(entries: readonly ZipEntrySize[]): boolean {
  return (
    entries.length <= ZIP_MAX_ENTRIES && zipSizeOf(entries) <= ZIP_MAX_BYTES
  );
}

/** MS-DOS 形式の日時。`date` の UTC の数字をそのまま使う（呼び出し側で日本時間に合わせる） */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  };
}

type CentralDirectoryEntry = {
  name: Uint8Array;
  crc: number;
  sizeBytes: number;
  offset: number;
};

export class ZipWriter {
  private offset = 0;
  private readonly entries: CentralDirectoryEntry[] = [];
  private readonly modified: { time: number; date: number };

  /**
   * @param sink 書いたバイト列を受け取る。渡したバイト列は書き換えない
   * @param modifiedAt ファイルの更新日時。UTC の数字をそのまま使う
   */
  constructor(
    private readonly sink: ZipSink,
    modifiedAt: Date,
  ) {
    this.modified = dosDateTime(modifiedAt);
  }

  /** 中身を先に持っているファイルを入れる */
  async addFile(name: string, bytes: Uint8Array): Promise<void> {
    const entry = this.startEntry(name, crc32(bytes), bytes.byteLength);
    await this.write(this.localFileHeader(entry));
    await this.write(bytes);
    this.entries.push(entry);
  }

  /**
   * 中身を流し込むファイルを入れる。CRC と大きさは先に求めて渡す（`crc32OfStream`）。
   * 流し込んだ大きさが違えば、壊れた zip にならないよう例外にする
   */
  async addStream(
    name: string,
    checksum: { crc: number; sizeBytes: number },
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const entry = this.startEntry(name, checksum.crc, checksum.sizeBytes);
    await this.write(this.localFileHeader(entry));
    let written = 0;
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        written += value.byteLength;
        if (written > entry.sizeBytes) {
          break;
        }
        await this.write(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (written !== entry.sizeBytes) {
      throw new Error(`${name} の大きさが、先に読んだときと違います`);
    }
    this.entries.push(entry);
  }

  /** セントラルディレクトリを書いて zip を閉じる。zip 全体の大きさ（バイト）を返す */
  async finish(): Promise<number> {
    const centralDirectoryOffset = this.offset;
    for (const entry of this.entries) {
      await this.write(this.centralDirectoryHeader(entry));
    }
    const centralDirectorySize = this.offset - centralDirectoryOffset;
    const end = new DataView(new ArrayBuffer(END_OF_CENTRAL_DIRECTORY_SIZE));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, centralDirectorySize, true);
    end.setUint32(16, centralDirectoryOffset, true);
    end.setUint16(20, 0, true);
    await this.write(new Uint8Array(end.buffer));
    return this.offset;
  }

  private startEntry(
    name: string,
    crc: number,
    sizeBytes: number,
  ): CentralDirectoryEntry {
    if (this.entries.length >= ZIP_MAX_ENTRIES || sizeBytes > ZIP_MAX_BYTES) {
      throw new ZipTooLargeError();
    }
    return { name: encoder.encode(name), crc, sizeBytes, offset: this.offset };
  }

  private localFileHeader(entry: CentralDirectoryEntry): Uint8Array {
    const header = new Uint8Array(LOCAL_FILE_HEADER_SIZE + entry.name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, 0, true); // STORE（圧縮しない）
    view.setUint16(10, this.modified.time, true);
    view.setUint16(12, this.modified.date, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.sizeBytes, true);
    view.setUint32(22, entry.sizeBytes, true);
    view.setUint16(26, entry.name.length, true);
    view.setUint16(28, 0, true);
    header.set(entry.name, LOCAL_FILE_HEADER_SIZE);
    return header;
  }

  private centralDirectoryHeader(entry: CentralDirectoryEntry): Uint8Array {
    const header = new Uint8Array(
      CENTRAL_DIRECTORY_HEADER_SIZE + entry.name.length,
    );
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, VERSION, true);
    view.setUint16(8, FLAG_UTF8, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, this.modified.time, true);
    view.setUint16(14, this.modified.date, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.sizeBytes, true);
    view.setUint32(24, entry.sizeBytes, true);
    view.setUint16(28, entry.name.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    header.set(entry.name, CENTRAL_DIRECTORY_HEADER_SIZE);
    return header;
  }

  private async write(chunk: Uint8Array): Promise<void> {
    this.offset += chunk.byteLength;
    if (this.offset > ZIP_MAX_BYTES) {
      throw new ZipTooLargeError();
    }
    await this.sink(chunk);
  }
}
