import { crc32 } from "node:zlib";

export type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  flags: number;
  method: number;
};

const decoder = new TextDecoder();

/** 汎用フラグの bit 3。CRC と大きさを、ローカルファイルヘッダーではなく中身の後のデータ記述子に書く */
const FLAG_DATA_DESCRIPTOR = 0x0008;

/**
 * テスト用の zip の読み取り（ZIP64 には対応しないため、小さな zip だけを読む）。セントラルディレクトリからファイルを読み、
 * ローカルファイルヘッダー（データ記述子を使うときはデータ記述子）の名前・大きさ・CRC が
 * セントラルディレクトリと一致することと、中身の CRC も確かめる
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
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      zip.subarray(offset + 46, offset + 46 + nameLength),
    );

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`${name} のローカルファイルヘッダーが正しくありません`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localName = decoder.decode(
      zip.subarray(localOffset + 30, localOffset + 30 + localNameLength),
    );
    if (localName !== name) {
      throw new Error(`${name} のローカルファイルヘッダーの名前が一致しません`);
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const bytes = zip.subarray(dataOffset, dataOffset + size);

    // データ記述子を使うときは中身の後（署名付き）、使わないときはローカルファイルヘッダーに CRC と大きさがある
    const [localCrc, localSize] =
      flags & FLAG_DATA_DESCRIPTOR
        ? readDataDescriptor(view, dataOffset + size, name)
        : [
            view.getUint32(localOffset + 14, true),
            view.getUint32(localOffset + 22, true),
          ];
    if (localCrc !== crc || localSize !== size) {
      throw new Error(
        `${name} の CRC・大きさがセントラルディレクトリと一致しません`,
      );
    }
    if (crc32(bytes) !== crc) {
      throw new Error(`${name} の CRC が中身と一致しません`);
    }
    entries.push({ name, bytes, flags, method });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readDataDescriptor(
  view: DataView,
  offset: number,
  name: string,
): [crc: number, size: number] {
  if (view.getUint32(offset, true) !== 0x08074b50) {
    throw new Error(`${name} のデータ記述子が見つかりません`);
  }
  return [view.getUint32(offset + 4, true), view.getUint32(offset + 12, true)];
}

/** zip の中の CSV を、BOM を除いた文字列にする */
export function csvText(entry: ZipEntry): string {
  return decoder.decode(entry.bytes).replace(/^﻿/, "");
}
