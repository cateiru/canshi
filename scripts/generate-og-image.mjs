import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const root = new URL("../", import.meta.url);
const icon = await readFile(new URL("public/icons/icon.svg", root), "utf8");

// 日本語の描画には Noto Sans CJK JP が必要。配信時は生成済みの PNG を使用する。
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fff8ed" />
  <g fill="#2e3142" font-family="Noto Sans CJK JP, sans-serif">
    <text x="88" y="271" font-size="38" font-weight="700" letter-spacing="3">愛猫の記録アプリ</text>
    <text x="80" y="392" font-size="108" font-weight="900" letter-spacing="4">CANSHI</text>
  </g>
  ${icon.replace("<svg ", '<svg x="758" y="144" width="342" height="342" ')}
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(new URL("src/app/opengraph-image.png", root).pathname);
console.log("OG 画像（1200 × 630px）を生成しました。");
