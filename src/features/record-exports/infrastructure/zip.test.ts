import { describe, expect, it } from "vitest";
import { readZip } from "../testing/readZip";
import {
  crc32,
  crc32OfStream,
  fitsInZip,
  ZIP_MAX_BYTES,
  ZIP_MAX_ENTRIES,
  ZipTooLargeError,
  ZipWriter,
  zipSizeOf,
} from "./zip";

const encoder = new TextEncoder();

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

async function writeZip(
  build: (zip: ZipWriter) => Promise<void>,
): Promise<{ bytes: Uint8Array; size: number }> {
  const chunks: Uint8Array[] = [];
  const zip = new ZipWriter(async (chunk) => {
    chunks.push(chunk.slice());
  }, new Date("2026-11-22T15:04:06Z"));
  await build(zip);
  const size = await zip.finish();
  const bytes = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, size };
}

describe("crc32", () => {
  it("CRC-32 の検査用の値と一致し、続きから計算できる", async () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(encoder.encode("6789"), crc32(encoder.encode("12345")))).toBe(
      0xcbf43926,
    );
    expect(
      await crc32OfStream(
        streamOf(encoder.encode("1234"), encoder.encode("56789")),
      ),
    ).toEqual({ crc: 0xcbf43926, sizeBytes: 9 });
  });
});

describe("ZipWriter", () => {
  it("中身を持っているファイルと流し込むファイルを、圧縮せずに入れる", async () => {
    const csv = encoder.encode("﻿ID\r\n1\r\n");
    const photo = new Uint8Array(70_000).map((_, i) => i % 251);
    const { bytes, size } = await writeZip(async (zip) => {
      await zip.addFile("poop_records.csv", csv);
      await zip.addStream(
        "photos/poop_records/r1-1.jpg",
        await crc32OfStream(streamOf(photo)),
        streamOf(photo.subarray(0, 100), photo.subarray(100)),
      );
      await zip.addFile("日本語.csv", new Uint8Array(0));
    });

    expect(bytes.byteLength).toBe(size);
    expect(size).toBe(
      zipSizeOf([
        { name: "poop_records.csv", sizeBytes: csv.byteLength },
        { name: "photos/poop_records/r1-1.jpg", sizeBytes: photo.byteLength },
        { name: "日本語.csv", sizeBytes: 0 },
      ]),
    );
    const entries = readZip(bytes);
    expect(entries.map(({ name }) => name)).toEqual([
      "poop_records.csv",
      "photos/poop_records/r1-1.jpg",
      "日本語.csv",
    ]);
    expect(entries[1].bytes).toEqual(photo);
    // UTF-8 のファイル名（bit 11）で、データ記述子（bit 3）は使わない。STORE（0）
    for (const entry of entries) {
      expect(entry.flags).toBe(0x0800);
      expect(entry.method).toBe(0);
    }
  });

  it("流し込んだ大きさが先に求めた大きさと違えば例外にする", async () => {
    const writing = writeZip(async (zip) => {
      await zip.addStream(
        "a.bin",
        { crc: 0, sizeBytes: 3 },
        streamOf(new Uint8Array(4)),
      );
    });
    await expect(writing).rejects.toThrow("先に読んだときと違います");
  });

  it("大きさが 4 GiB を超えるファイルは ZipTooLargeError", async () => {
    const writing = writeZip(async (zip) => {
      await zip.addStream(
        "a.bin",
        { crc: 0, sizeBytes: ZIP_MAX_BYTES + 1 },
        streamOf(new Uint8Array(1)),
      );
    });
    await expect(writing).rejects.toBeInstanceOf(ZipTooLargeError);
  });
});

describe("fitsInZip", () => {
  it("大きさとファイル数が ZIP64 を使わずに書ける範囲かを返す", () => {
    expect(fitsInZip([{ name: "a.csv", sizeBytes: 10 }])).toBe(true);
    // ヘッダー・セントラルディレクトリ・終端で 108 バイトを足すと、ちょうど上限になる
    expect(fitsInZip([{ name: "a.csv", sizeBytes: ZIP_MAX_BYTES - 108 }])).toBe(
      true,
    );
    expect(fitsInZip([{ name: "a.csv", sizeBytes: ZIP_MAX_BYTES - 107 }])).toBe(
      false,
    );
    expect(
      fitsInZip(
        Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, i) => ({
          name: `${i}`,
          sizeBytes: 0,
        })),
      ),
    ).toBe(false);
  });
});
