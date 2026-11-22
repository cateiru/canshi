import { crc32 } from "../infrastructure/zip";

export type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  flags: number;
  method: number;
};

const decoder = new TextDecoder();

/**
 * テスト用の zip の読み取り。セントラルディレクトリからファイルを読み、ローカルファイルヘッダーの
 * 名前・大きさ・CRC がセントラルディレクトリと一致することと、中身の CRC も確かめる
 */
export function readZip(zip: Uint8Array): ZipEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const endOffset = zip.byteLength - 22;
  if (view.getUint32(endOffset, true) !== 0x06054b50) {
    throw new Error("end of central directory が見つかりません");
  }
  const count = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  let offset = view.getUint32(endOffset + 16, true);
  if (offset + centralDirectorySize !== endOffset) {
    throw new Error("セントラルディレクトリの位置が正しくありません");
  }

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("セントラルディレクトリのヘッダーが正しくありません");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      zip.subarray(offset + 46, offset + 46 + nameLength),
    );

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`${name} のローカルファイルヘッダーが正しくありません`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localName = decoder.decode(
      zip.subarray(localOffset + 30, localOffset + 30 + localNameLength),
    );
    if (
      localName !== name ||
      view.getUint32(localOffset + 14, true) !== crc ||
      view.getUint32(localOffset + 22, true) !== size
    ) {
      throw new Error(`${name} のローカルファイルヘッダーが一致しません`);
    }
    const dataOffset = localOffset + 30 + localNameLength;
    const bytes = zip.subarray(dataOffset, dataOffset + size);
    if (crc32(bytes) !== crc) {
      throw new Error(`${name} の CRC が一致しません`);
    }
    entries.push({ name, bytes, flags, method });
    offset += 46 + nameLength;
  }
  return entries;
}

/** zip の中の CSV を、BOM を除いた文字列にする */
export function csvText(entry: ZipEntry): string {
  return decoder.decode(entry.bytes).replace(/^﻿/, "");
}
