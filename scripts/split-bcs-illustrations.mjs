import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

/**
 * BCS のイラスト（docs/illustrations/bcs/*.png）を、猫の毛色で塗り替えられるように層に分ける。
 *
 * 元の画像は、濃紺の輪郭・ベージュの塗り（ガイドでは白い手とオレンジの点線も）の数色だけで描かれている。
 * ピクセルごとに、その色を画像の色の 2 色の混ざり具合として求め、次の 3 つに分ける。
 *
 * - `<名前>-fill.png`：猫の塗りの範囲（アルファのマスク）。画面で毛色（--illustration-cat-coat）を塗る
 * - `<名前>-line.png`：輪郭の範囲（アルファのマスク）。画面で輪郭の色（--illustration-outline）を塗る
 * - `<名前>-overlay.png`：白い手・オレンジの点線（元の色のまま）。ガイドの画像だけ
 *
 * 画面では下から 塗り・重ね・輪郭 の順に描くと、元の画像と同じ見た目になる。
 * 画像の大きさなどは src/features/weight-records/presentation/bcsIllustrationLayers.ts に書き出す。
 */

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const root = new URL("../", import.meta.url);

const SOURCES = [
  "bcs-1",
  "bcs-2",
  "bcs-3",
  "bcs-4",
  "bcs-5",
  "bcs-guide-ribs",
  "bcs-guide-top",
  "bcs-guide-side",
];

/** 画像の中の色の目安。実際の色は、画像ごとに目安に近いピクセルの最頻値の付近の平均にする */
const SEEDS = {
  fill: [249, 204, 163],
  line: [22, 30, 59],
  white: [252, 252, 252],
  accent: [240, 136, 62],
};

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** 目安に近い（ほぼ不透明な）ピクセルの最頻値を求め、その付近の平均を画像の色とする */
function estimateColor(data, seed) {
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const color = [data[i], data[i + 1], data[i + 2]];
    if (distance(color, seed) > 40) continue;
    const key = color.join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const mode = [...counts]
    .sort((a, b) => b[1] - a[1])[0][0]
    .split(",")
    .map(Number);
  const sum = [0, 0, 0];
  let total = 0;
  for (const [key, count] of counts) {
    const color = key.split(",").map(Number);
    if (distance(color, mode) > 8) continue;
    for (let c = 0; c < 3; c++) sum[c] += color[c] * count;
    total += count;
  }
  return sum.map((value) => value / total);
}

/** 色 c を、2 色 p・q の混ざり（p の割合 t）として表したときの t と、ずれの大きさ */
function unmix(c, p, q) {
  const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const length = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const t = Math.min(
    1,
    Math.max(
      0,
      ((c[0] - q[0]) * d[0] + (c[1] - q[1]) * d[1] + (c[2] - q[2]) * d[2]) /
        length,
    ),
  );
  const mixed = [0, 1, 2].map((i) => q[i] + d[i] * t);
  return { t, error: distance(c, mixed) };
}

async function split(name) {
  const source = new URL(`docs/illustrations/bcs/${name}.png`, root).pathname;
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const fillColor = estimateColor(data, SEEDS.fill);
  const lineColor = estimateColor(data, SEEDS.line);
  // 白・オレンジのない画像では、これらへの振り分けを試さない（塗りのむらを白と取り違えないため）
  const extras = [
    estimateColor(data, SEEDS.white),
    estimateColor(data, SEEDS.accent),
  ].filter(Boolean);
  const palette = [
    { kind: "fill", color: fillColor },
    { kind: "line", color: lineColor },
    ...extras.map((color) => ({ kind: "overlay", color })),
  ];

  const fill = new Uint8Array(width * height);
  const line = new Uint8Array(width * height);
  const overlay = Buffer.alloc(width * height * 4);
  let hasOverlay = false;

  for (let i = 0; i < width * height; i++) {
    const alpha = data[i * 4 + 3] / 255;
    if (alpha === 0) continue;
    const color = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];

    // 画像の色のうち、最もよく当てはまる 2 色の混ざりとして表す。
    // 白・オレンジは、塗り・輪郭だけで当てはまるときより明らかによいときだけ使う
    let best = null;
    for (let a = 0; a < palette.length; a++) {
      for (let b = a + 1; b < palette.length; b++) {
        const { t, error } = unmix(color, palette[a].color, palette[b].color);
        const usesOverlay =
          palette[a].kind === "overlay" || palette[b].kind === "overlay";
        const score = error + (usesOverlay ? 12 : 0);
        if (!best || score < best.score) {
          best = { score, a: palette[a], b: palette[b], t };
        }
      }
    }

    // 各色が占める割合（面積の割合として、合計がアルファになる）
    const coverage = { fill: 0, line: 0, overlay: 0 };
    let overlayColor = null;
    for (const [entry, share] of [
      [best.a, best.t],
      [best.b, 1 - best.t],
    ]) {
      coverage[entry.kind] += alpha * share;
      if (entry.kind === "overlay" && share > 0) {
        overlayColor = overlayColor
          ? color // 白とオレンジの境目は、元の色をそのまま使う
          : entry.color;
      }
    }

    // 下から 塗り・重ね・輪郭 の順に重ねたときに元の色になるよう、各層の不透明度を求める
    const lineAlpha = coverage.line;
    const restAfterLine = 1 - lineAlpha;
    const overlayAlpha =
      restAfterLine > 1e-6 ? Math.min(1, coverage.overlay / restAfterLine) : 0;
    const restAfterOverlay = restAfterLine * (1 - overlayAlpha);
    const fillAlpha =
      restAfterOverlay > 1e-6
        ? Math.min(1, coverage.fill / restAfterOverlay)
        : 0;

    fill[i] = Math.round(fillAlpha * 255);
    line[i] = Math.round(lineAlpha * 255);
    if (overlayColor && overlayAlpha > 0) {
      const value = Math.round(overlayAlpha * 255);
      if (value > 0) {
        hasOverlay = true;
        overlay[i * 4] = Math.round(overlayColor[0]);
        overlay[i * 4 + 1] = Math.round(overlayColor[1]);
        overlay[i * 4 + 2] = Math.round(overlayColor[2]);
        overlay[i * 4 + 3] = value;
      }
    }
  }

  const output = (suffix) =>
    new URL(`public/images/bcs/${name}-${suffix}.png`, root).pathname;
  for (const [suffix, mask] of [
    ["fill", fill],
    ["line", line],
  ]) {
    // 色は白、範囲はアルファで持つ（SVG の mask-type: alpha で使う）
    const raw = Buffer.alloc(width * height * 2, 255);
    for (let i = 0; i < width * height; i++) raw[i * 2 + 1] = mask[i];
    await sharp(raw, { raw: { width, height, channels: 2 } })
      .png({ compressionLevel: 9 })
      .toFile(output(suffix));
  }
  if (hasOverlay) {
    await sharp(overlay, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(output("overlay"));
  }

  return {
    name,
    width,
    height,
    hasOverlay,
    fillColor,
  };
}

const results = [];
for (const name of SOURCES) {
  results.push(await split(name));
}

const toHex = (color) =>
  `#${color
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;

const entries = results
  .map(
    ({ name, width, height, hasOverlay }) =>
      `  "${name}": { width: ${width}, height: ${height}, hasOverlay: ${hasOverlay} },`,
  )
  .join("\n");

const manifest = `// このファイルは scripts/split-bcs-illustrations.mjs が生成する。手で編集しない。

export type BcsIllustrationLayers = {
  width: number;
  height: number;
  /** 白い手・オレンジの点線など、元の色のまま重ねる画像があるか */
  hasOverlay: boolean;
};

/** 元の画像の塗りの色。毛色が未設定のときに使う */
export const BCS_ILLUSTRATION_DEFAULT_FILL = "${toHex(results[2].fillColor)}";

export const BCS_ILLUSTRATION_LAYERS = {
${entries}
} as const satisfies Record<string, BcsIllustrationLayers>;

export type BcsIllustrationName = keyof typeof BCS_ILLUSTRATION_LAYERS;
`;

const manifestPath = new URL(
  "src/features/weight-records/presentation/bcsIllustrationLayers.ts",
  root,
).pathname;
await writeFile(manifestPath, manifest);
// 書き出した TypeScript をリポジトリの書式にそろえる
execFileSync(
  new URL("node_modules/.bin/biome", root).pathname,
  ["format", "--write", manifestPath],
  { stdio: "inherit" },
);

for (const { name, fillColor } of results) {
  console.log(name, toHex(fillColor));
}
