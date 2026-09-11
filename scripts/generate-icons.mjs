import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Next.js が画像処理に使用する sharp を再利用する。
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const root = new URL("../", import.meta.url);
const source = await readFile(new URL("public/icons/icon.svg", root), "utf8");
const fullBleed = source.replace('rx="112"', 'rx="0"');
// 中心から半径 40% のセーフエリア内に、耳を含む猫全体を収める。
const maskable = fullBleed.replace(
  '<g id="cat">',
  '<g id="cat" transform="translate(256 256) scale(0.8) translate(-256 -256)">',
);

for (const [path, svg] of [
  ["src/app/icon.svg", source],
  ["public/icons/apple-touch-icon.svg", fullBleed],
  ["public/icons/icon-maskable.svg", maskable],
]) {
  await writeFile(new URL(path, root), svg);
}

for (const [path, svg, size] of [
  ["public/icons/icon-192.png", source, 192],
  ["public/icons/icon-512.png", source, 512],
  ["public/icons/apple-touch-icon.png", fullBleed, 180],
  ["public/icons/icon-maskable-192.png", maskable, 192],
  ["public/icons/icon-maskable-512.png", maskable, 512],
]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(new URL(path, root).pathname);
}

// ICO に各サイズの PNG を格納し、各表示サイズに合わせたマークを提供する。
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) =>
    sharp(Buffer.from(source)).resize(size, size).png().toBuffer(),
  ),
);
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(
  new URL("src/app/favicon.ico", root),
  Buffer.concat([header, ...frames]),
);
console.log("favicon・PWA・Apple touch icon を生成しました。");
