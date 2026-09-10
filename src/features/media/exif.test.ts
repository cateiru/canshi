import { describe, expect, it } from "vitest";
import {
  buildMinimalExifTiff,
  buildPngChunk,
  parseTiffOrientation,
  sanitizeImage,
} from "./exif";

function bytesOf(...parts: (string | number[] | Uint8Array)[]): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      for (const char of part) {
        out.push(char.charCodeAt(0));
      }
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out);
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

/** ビッグエンディアン（"MM"）で Orientation と GPS IFD ポインタを持つ TIFF */
function bigEndianTiff(orientation: number): Uint8Array {
  return bytesOf(
    "MM",
    [0x00, 0x2a],
    [0x00, 0x00, 0x00, 0x08],
    [0x00, 0x02],
    // Orientation
    [0x01, 0x12],
    [0x00, 0x03],
    [0x00, 0x00, 0x00, 0x01],
    [0x00, orientation, 0x00, 0x00],
    // GPSInfo IFD pointer（位置情報の存在を模す）
    [0x88, 0x25],
    [0x00, 0x04],
    [0x00, 0x00, 0x00, 0x01],
    [0x00, 0x00, 0x00, 0x26],
    [0x00, 0x00, 0x00, 0x00],
  );
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return bytesOf([0xff, marker, (length >> 8) & 0xff, length & 0xff], payload);
}

const GPS_MARKER = bytesOf([0x88, 0x25]);

describe("parseTiffOrientation", () => {
  it("リトルエンディアン・ビッグエンディアンの両方を読める", () => {
    expect(parseTiffOrientation(buildMinimalExifTiff(6))).toBe(6);
    expect(parseTiffOrientation(bigEndianTiff(8))).toBe(8);
  });

  it("Orientation がない・壊れている場合は null", () => {
    expect(
      parseTiffOrientation(bytesOf("II", [0x2a, 0x00, 0x08, 0, 0, 0])),
    ).toBeNull();
    expect(parseTiffOrientation(bytesOf("XX"))).toBeNull();
    expect(parseTiffOrientation(bigEndianTiff(9))).toBeNull();
  });
});

describe("sanitizeImage (JPEG)", () => {
  const jfif = jpegSegment(
    0xe0,
    bytesOf("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0]),
  );
  const exif = jpegSegment(0xe1, bytesOf("Exif\0\0", bigEndianTiff(6)));
  const xmp = jpegSegment(
    0xe1,
    bytesOf("http://ns.adobe.com/xap/1.0/\0", "<x:xmpmeta>gps</x:xmpmeta>"),
  );
  const icc = jpegSegment(0xe2, bytesOf("ICC_PROFILE\0", [1, 1], "icc-data"));
  const mpf = jpegSegment(0xe2, bytesOf("MPF\0", "multi-picture"));
  const dqt = jpegSegment(0xdb, bytesOf([0x00], new Array(64).fill(1)));
  const sos = bytesOf([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  ]);
  const scanData = bytesOf(
    [0x12, 0x34, 0xff, 0x00, 0x56],
    [0xff, 0xd0],
    [0x78],
  );
  const eoi = bytesOf([0xff, 0xd9]);

  it("EXIF・XMP・MPF を除去し、ICC・DQT・画素データは保持する", () => {
    const input = bytesOf(
      [0xff, 0xd8],
      jfif,
      exif,
      xmp,
      icc,
      mpf,
      dqt,
      sos,
      scanData,
      eoi,
    );
    const { bytes, orientation } = sanitizeImage(input, "image/jpeg");

    expect(orientation).toBe(6);
    expect(contains(bytes, GPS_MARKER)).toBe(false);
    expect(contains(bytes, bytesOf("xmpmeta"))).toBe(false);
    expect(contains(bytes, bytesOf("multi-picture"))).toBe(false);
    expect(contains(bytes, bytesOf("ICC_PROFILE\0"))).toBe(true);
    expect(contains(bytes, dqt)).toBe(true);
    expect(contains(bytes, bytesOf(sos, scanData, eoi))).toBe(true);
    expect(bytes.subarray(0, 2)).toEqual(bytesOf([0xff, 0xd8]));
  });

  it("Orientation だけを持つ最小の EXIF を JFIF の直後に再挿入する", () => {
    const input = bytesOf([0xff, 0xd8], jfif, exif, dqt, sos, scanData, eoi);
    const { bytes } = sanitizeImage(input, "image/jpeg");

    const expectedExif = jpegSegment(
      0xe1,
      bytesOf("Exif\0\0", buildMinimalExifTiff(6)),
    );
    expect(bytes.subarray(0, 2 + jfif.length + expectedExif.length)).toEqual(
      bytesOf([0xff, 0xd8], jfif, expectedExif),
    );
    expect(parseTiffOrientation(expectedExif.subarray(4 + 6))).toBe(6);
  });

  it("正位置（Orientation=1）や EXIF なしの場合は EXIF を挿入しない", () => {
    const upright = jpegSegment(0xe1, bytesOf("Exif\0\0", bigEndianTiff(1)));
    const withUpright = sanitizeImage(
      bytesOf([0xff, 0xd8], upright, dqt, sos, scanData, eoi),
      "image/jpeg",
    );
    expect(withUpright.orientation).toBe(1);
    expect(withUpright.bytes).toEqual(
      bytesOf([0xff, 0xd8], dqt, sos, scanData, eoi),
    );

    const withoutExif = sanitizeImage(
      bytesOf([0xff, 0xd8], jfif, dqt, sos, scanData, eoi),
      "image/jpeg",
    );
    expect(withoutExif.bytes).toEqual(
      bytesOf([0xff, 0xd8], jfif, dqt, sos, scanData, eoi),
    );
  });

  it("JPEG でないデータはそのまま返す", () => {
    const input = bytesOf("not a jpeg");
    expect(sanitizeImage(input, "image/jpeg").bytes).toBe(input);
  });
});

describe("sanitizeImage (PNG)", () => {
  const signature = bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = buildPngChunk(
    "IHDR",
    bytesOf([0, 0, 0, 2, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  );
  const idat = buildPngChunk("IDAT", bytesOf([1, 2, 3, 4]));
  const iend = buildPngChunk("IEND", new Uint8Array(0));

  it("eXIf・tEXt・iTXt・zTXt を除去し、他のチャンクは保持する", () => {
    const input = bytesOf(
      signature,
      ihdr,
      buildPngChunk("eXIf", bigEndianTiff(3)),
      buildPngChunk("tEXt", bytesOf("Comment\0secret")),
      buildPngChunk("iTXt", bytesOf("XML:com.adobe.xmp\0\0\0\0\0<gps/>")),
      buildPngChunk("zTXt", bytesOf("Description\0\0zzz")),
      buildPngChunk("pHYs", bytesOf([0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1])),
      idat,
      iend,
    );
    const { bytes, orientation } = sanitizeImage(input, "image/png");

    expect(orientation).toBe(3);
    expect(contains(bytes, bytesOf("secret"))).toBe(false);
    expect(contains(bytes, bytesOf("<gps/>"))).toBe(false);
    expect(contains(bytes, bytesOf("zzz"))).toBe(false);
    expect(contains(bytes, bytesOf("tEXt"))).toBe(false);
    expect(contains(bytes, bytesOf("pHYs"))).toBe(true);
    // 回転情報だけの eXIf を IHDR の直後に置く
    const expected = bytesOf(
      signature,
      ihdr,
      buildPngChunk("eXIf", buildMinimalExifTiff(3)),
      buildPngChunk("pHYs", bytesOf([0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1])),
      idat,
      iend,
    );
    expect(bytes).toEqual(expected);
  });

  it("メタデータのない PNG は変化しない", () => {
    const input = bytesOf(signature, ihdr, idat, iend);
    expect(sanitizeImage(input, "image/png").bytes).toEqual(input);
  });
});

describe("sanitizeImage (WebP)", () => {
  function riffChunk(fourcc: string, data: Uint8Array): Uint8Array {
    const size = data.length;
    return bytesOf(
      fourcc,
      [
        size & 0xff,
        (size >> 8) & 0xff,
        (size >> 16) & 0xff,
        (size >> 24) & 0xff,
      ],
      data,
      size % 2 === 1 ? [0] : [],
    );
  }
  function webp(...chunks: Uint8Array[]): Uint8Array {
    const body = bytesOf(...chunks);
    const size = 4 + body.length;
    return bytesOf(
      "RIFF",
      [
        size & 0xff,
        (size >> 8) & 0xff,
        (size >> 16) & 0xff,
        (size >> 24) & 0xff,
      ],
      "WEBP",
      body,
    );
  }

  const vp8xWithExifAndXmp = riffChunk(
    "VP8X",
    bytesOf([0x0c, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
  );
  const vp8 = riffChunk("VP8 ", bytesOf([0x10, 0x20, 0x30])); // 奇数長（パディング確認）

  it("EXIF・XMP チャンクを除去し、RIFF サイズと VP8X フラグを更新する", () => {
    const input = webp(
      vp8xWithExifAndXmp,
      vp8,
      riffChunk("EXIF", bytesOf("Exif\0\0", bigEndianTiff(6))),
      riffChunk("XMP ", bytesOf("<x:xmpmeta>gps</x:xmpmeta>")),
    );
    const { bytes, orientation } = sanitizeImage(input, "image/webp");

    expect(orientation).toBe(6);
    expect(contains(bytes, GPS_MARKER)).toBe(false);
    expect(contains(bytes, bytesOf("xmpmeta"))).toBe(false);
    expect(contains(bytes, bytesOf("XMP "))).toBe(false);
    const expected = webp(
      // EXIF フラグ（0x08）だけ立て、XMP フラグ（0x04）は落とす
      riffChunk("VP8X", bytesOf([0x08, 0, 0, 0, 1, 0, 0, 0, 0, 0])),
      vp8,
      riffChunk("EXIF", buildMinimalExifTiff(6)),
    );
    expect(bytes).toEqual(expected);
  });

  it("VP8X のない単純形式には EXIF を再挿入しない", () => {
    const input = webp(vp8, riffChunk("EXIF", bigEndianTiff(6)));
    const { bytes, orientation } = sanitizeImage(input, "image/webp");
    expect(orientation).toBe(6);
    expect(bytes).toEqual(webp(vp8));
  });
});

describe("sanitizeImage (GIF)", () => {
  it("GIF はそのまま返す", () => {
    const input = bytesOf("GIF89a", [1, 0, 1, 0, 0, 0, 0]);
    expect(sanitizeImage(input, "image/gif").bytes).toBe(input);
  });
});
