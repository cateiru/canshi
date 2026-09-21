import path from "node:path";
import {
  test as base,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

// reg-suit (VRT) 向けのスナップショットヘルパー。
//
// 以前使っていた @chromatic-com/playwright の `test` / `expect` / `takeSnapshot` /
// `ignoreSelectors` と同じ形で使えるようにしてあるため、vrt.spec.ts 側はこのモジュールから
// import するだけで動く。Chromatic はDOMを送ってクラウド側でレンダリング・比較していたが、
// reg-suit は画像同士を比較するツールなので、ここでは実際にPNGスクリーンショットを撮って
// `regconfig.json` の `core.actualDir` に書き出す。
//
// `ignoreSelectors` も同様に、Chromatic では「比較から除外する領域」だったが、
// reg-suit にそのような概念はないため、Playwright の `screenshot({ mask })` で
// 該当要素を塗りつぶしてから撮影することで、実行日時などに依存する領域を
// 見た目の差分として検出されないようにしている。

const ACTUAL_DIR = path.join(process.cwd(), "vrt-screenshots", "actual");

// 全ページ共通で常にマスクする要素。`test.use({ ignoreSelectors })` は値を
// 丸ごと置き換えてしまうため、ページ個別の要素と混ざって書き漏れないよう、
// 個別の ignoreSelectors とは別に常時マージする
const ALWAYS_MASKED_SELECTORS = [
  // footer全体(バージョン表示・コピーライトの年)。バージョンの桁数が変わると
  // リンク要素自体の横幅が変わり、その要素だけをマスクしていてもマスクの矩形サイズが
  // 変わって差分になってしまうため、幅が常に一定な footer 要素ごとマスクする
  "footer",
];

// 全ページ共通で常に非表示にする要素。mask ではなく display: none を使う（下記コメント参照）
const ALWAYS_HIDDEN_SELECTORS = [
  // next dev のポータル（Next.js の開発用オーバーレイ。ビルドエラーやハイドレーション不整合
  // が起きると画面隅にトースト表示される）。custom element のホスト自体は 0x0 のままで、
  // 実体は shadow DOM 内で position: fixed によりレイアウトから独立して描画されるため、
  // screenshot({ mask })（ホスト要素のバウンディングボックスを塗りつぶす方式）はホストの
  // 0x0 の矩形を塗りつぶすだけで実際には効かない。ホストの display を none にすれば
  // shadow tree ごと確実に非表示にできる
  "nextjs-portal",
];

type VrtFixtures = {
  ignoreSelectors: string[];
};

const ignoreSelectorsByPage = new WeakMap<Page, string[]>();

export const test = base.extend<VrtFixtures>({
  ignoreSelectors: [[], { option: true }],
  page: async ({ page, ignoreSelectors }, use) => {
    ignoreSelectorsByPage.set(page, [
      ...ALWAYS_MASKED_SELECTORS,
      ...ignoreSelectors,
    ]);
    await use(page);
    ignoreSelectorsByPage.delete(page);
  },
});

export { expect };

function toFileName(testInfo: TestInfo): string {
  // titlePath の先頭はプロジェクト名 (例: "chromium") なので除く
  return `${testInfo.titlePath
    .slice(1)
    .filter((title) => title.length > 0)
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "_")}.png`;
}

export async function takeSnapshot(page: Page, testInfo: TestInfo) {
  const ignoreSelectors = ignoreSelectorsByPage.get(page) ?? [];
  const mask: Locator[] = ignoreSelectors.map((selector) =>
    page.locator(selector),
  );

  await page.addStyleTag({
    content: `${ALWAYS_HIDDEN_SELECTORS.join(", ")} { display: none !important; }`,
  });

  await page.screenshot({
    path: path.join(ACTUAL_DIR, toFileName(testInfo)),
    fullPage: true,
    mask,
    // CSS transition の途中で撮影してしまうと、実行のたびに途中経過のフレームが写り込み
    // 差分になる。"disabled" は有限アニメーションを完了状態まで早送りしてから撮影するため、
    // 常に確定した見た目で撮影できる
    animations: "disabled",
  });
}
