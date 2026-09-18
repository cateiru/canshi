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
  <circle cx="1140" cy="65" r="280" fill="#f5dfb7" opacity="0.55" />
  <circle cx="1060" cy="610" r="235" fill="#f4b0a3" opacity="0.2" />
  <rect x="88" y="92" width="56" height="8" rx="4" fill="#ec995a" />
  <g fill="#2e3142" font-family="Noto Sans CJK JP, sans-serif">
    <text x="88" y="164" font-size="26" font-weight="500" letter-spacing="3">愛猫の記録アプリ</text>
    <text x="80" y="296" font-size="108" font-weight="900" letter-spacing="4">CANSHI</text>
    <text x="88" y="380" font-size="38" font-weight="700">毎日の記録で、</text>
    <text x="88" y="436" font-size="38" font-weight="700">愛猫を見守る。</text>
    <text x="88" y="538" font-size="22" fill="#686a77" letter-spacing="2">ごはん・体重・健康を、ひとつに。</text>
  </g>
  <rect x="770" y="157" width="342" height="342" rx="75" fill="#2e3142" opacity="0.06" />
  ${icon.replace("<svg ", '<svg x="758" y="141" width="342" height="342" ')}
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(new URL("src/app/opengraph-image.png", root).pathname);
console.log("OG 画像（1200 × 630px）を生成しました。");
