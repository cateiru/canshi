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

type VrtFixtures = {
  ignoreSelectors: string[];
};

const ignoreSelectorsByPage = new WeakMap<Page, string[]>();

export const test = base.extend<VrtFixtures>({
  ignoreSelectors: [["nextjs-portal"], { option: true }],
  page: async ({ page, ignoreSelectors }, use) => {
    ignoreSelectorsByPage.set(page, ignoreSelectors);
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

  await page.screenshot({
    path: path.join(ACTUAL_DIR, toFileName(testInfo)),
    fullPage: true,
    mask,
  });
}
