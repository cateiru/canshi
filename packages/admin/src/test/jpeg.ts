/**
 * テスト用の JPEG のバイト列。寸法の判定に使うマーカー（SOI・APP0・SOF0・SOS）だけを持ち、
 * 画像としては表示できない。`exif` を立てると APP1（Exif）のセグメントを足す。
 * `padding` を指定すると、その長さのコメント（COM）のセグメントで大きさを増やす
 */
export function createJpeg(
  width: number,
  height: number,
  options: { exif?: boolean; padding?: number } = {},
) {
  const segment = (marker: number, data: number[]) => [
    0xff,
    marker,
    (data.length + 2) >> 8,
    (data.length + 2) & 0xff,
    ...data,
  ];
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
  return new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...(options.exif
      ? segment(0xe1, [...ascii("Exif"), 0, 0, 1, 2, 3, 4])
      : []),
    ...(options.padding
      ? segment(0xfe, new Array<number>(options.padding).fill(0x20))
      : []),
    ...segment(0xc0, [
      8,
      height >> 8,
      height & 0xff,
      width >> 8,
      width & 0xff,
      1,
      1,
      0x11,
      0,
    ]),
    ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    0x00,
    0xff,
    0xd9,
  ]);
}
