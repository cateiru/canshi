import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, takeSnapshot, test } from "../e2e/vrt-snapshot";

// 共通のパッケージ（packages/shared）のビジュアルリグレッションテスト (reg-suit)。
//
// `pnpm --filter @canshi/shared build-storybook` でビルドした Storybook（storybook-static）を配信し、
// ストーリーを 1 つずつ開いて撮る。撮るストーリーは storybook-static/index.json から読むため、
// ストーリーを足すと自動で撮影の対象になる。`pnpm vrt:shared` はビルドしてから実行する。
//
// - すべてのストーリーを、ライト・ダークテーマで撮る
// - コントラスト・アクセントカラー・文字サイズは組み合わせが多いため、それぞれの設定が効く部品の
//   ストーリー（下の ACCENT_STORIES・CONTRAST_STORIES・FONT_SIZE_STORIES）で代表して撮る
// - Select・DropdownMenu は、候補・メニューを開いた見た目も撮る
//
// 見た目設定は、Storybook のツールバーと同じ globals（.storybook/preview.tsx）を URL で渡して切り替える。
// 実行するたびに見た目が変わるストーリー（紙吹雪など）は、ストーリーに `no-vrt` タグを付けて除く

const STORYBOOK_INDEX = path.join(
  process.cwd(),
  "packages/shared/storybook-static/index.json",
);

type StoryIndexEntry = {
  type: "story" | "docs";
  id: string;
  title: string;
  name: string;
  tags?: string[];
};

type Story = Pick<StoryIndexEntry, "id" | "title" | "name">;

function readStories(): Story[] {
  let raw: string;
  try {
    raw = readFileSync(STORYBOOK_INDEX, "utf8");
  } catch {
    throw new Error(
      `${STORYBOOK_INDEX} がありません。先に \`pnpm --filter @canshi/shared build-storybook\` で Storybook をビルドしてください（\`pnpm vrt:shared\` はビルドしてから実行します）`,
    );
  }
  const index = JSON.parse(raw) as {
    entries: Record<string, StoryIndexEntry>;
  };
  return Object.values(index.entries)
    .filter(
      (entry) => entry.type === "story" && !entry.tags?.includes("no-vrt"),
    )
    .map(({ id, title, name }) => ({ id, title, name }));
}

const STORIES = readStories();

/** `title`（`フォーム/Select` など）と `name`（`Default` など）でストーリーを探す */
function story(title: string, name: string): Story {
  const found = STORIES.find(
    (entry) => entry.title === title && entry.name === name,
  );
  if (!found) {
    throw new Error(`ストーリー「${title} ${name}」が見つかりません`);
  }
  return found;
}

type Globals = {
  theme?: "light" | "dark";
  accent?: "orange" | "blue" | "green" | "pink" | "purple";
  contrast?: "default" | "more";
  fontSize?: "small" | "medium" | "large" | "xlarge";
};

function storyUrl({ id }: Story, globals: Globals = {}): string {
  const params = new URLSearchParams({ id, viewMode: "story" });
  const entries = Object.entries(globals);
  if (entries.length > 0) {
    params.set(
      "globals",
      entries.map(([key, value]) => `${key}:${value}`).join(";"),
    );
  }
  return `/iframe.html?${params.toString()}`;
}

/** ストーリーを開き、描画・フォント・画像の読み込みが終わるまで待つ */
async function openStory(page: Page, target: Story, globals: Globals = {}) {
  await page.goto(storyUrl(target, globals));
  // Storybook は描画が終わると body に sb-show-main を付ける（エラーのときは sb-show-errordisplay）
  await expect(page.locator("body")).toHaveClass(/\bsb-show-main\b/);
  for (const [key, value] of Object.entries(globals)) {
    const attribute = key === "fontSize" ? "data-font-size" : `data-${key}`;
    await expect(page.locator("html")).toHaveAttribute(attribute, value);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        image.decode().catch(() => undefined),
      ),
    );
  });
}

function storyTitle({ title, name }: Story): string {
  return `${title} ${name}`;
}

// アクセントカラーを使う部品（選択中・押す操作の色）
const ACCENT_STORIES = [
  story("デザイントークン", "Colors"),
  story("操作/Button", "Primary"),
  story("操作/SegmentedControl", "Medium"),
  story("フォーム/Checkbox", "Selected"),
  story("フォーム/Radio", "Default"),
  story("フォーム/Slider", "Default"),
  story("ナビゲーション/Tabs", "Default"),
];

// コントラストを上げると、文字・枠線・入力欄の色が変わる部品
const CONTRAST_STORIES = [
  story("デザイントークン", "Colors"),
  story("操作/Button", "Primary"),
  story("操作/Button", "Secondary"),
  story("表示/Alert", "Info"),
  story("表示/Badge", "All Colors"),
  story("フォーム/FormField", "With Error"),
  story("フォーム/Checkbox", "Default"),
  story("ナビゲーション/Tabs", "Default"),
];

// 文字サイズに合わせて、文字・アイコン・チェックボックスなどの目印が拡大縮小する部品
const FONT_SIZE_STORIES = [
  story("デザイントークン", "Text"),
  story("操作/Button", "With Icon"),
  story("操作/DropdownMenu", "Primary"),
  story("フォーム/FormField", "Default"),
  story("フォーム/Select", "Default"),
  story("フォーム/Checkbox", "Default"),
  story("フォーム/Radio", "Default"),
  story("ナビゲーション/MonthNav", "Default"),
];

for (const { label, theme } of [
  { label: "ライト", theme: "light" },
  { label: "ダーク", theme: "dark" },
] as const) {
  test.describe(label, () => {
    for (const target of STORIES) {
      test(storyTitle(target), async ({ page }, testInfo) => {
        await openStory(page, target, { theme });
        await takeSnapshot(page, testInfo);
      });
    }
  });
}

for (const { label, theme } of [
  { label: "ライト・コントラスト上げ", theme: "light" },
  { label: "ダーク・コントラスト上げ", theme: "dark" },
] as const) {
  test.describe(label, () => {
    for (const target of CONTRAST_STORIES) {
      test(storyTitle(target), async ({ page }, testInfo) => {
        await openStory(page, target, { theme, contrast: "more" });
        await takeSnapshot(page, testInfo);
      });
    }
  });
}

// 標準のオレンジは上のライト・ダークで撮れているため除く。--color-accent-strong はライトとダークで
// 値が違うため、両方のテーマで撮る
for (const accent of ["blue", "green", "pink", "purple"] as const) {
  for (const { label, theme } of [
    { label: "ライト", theme: "light" },
    { label: "ダーク", theme: "dark" },
  ] as const) {
    test.describe(`アクセントカラー（${accent}・${label}）`, () => {
      for (const target of ACCENT_STORIES) {
        test(storyTitle(target), async ({ page }, testInfo) => {
          await openStory(page, target, { theme, accent });
          await takeSnapshot(page, testInfo);
        });
      }

      test("Select の候補を開いた見た目", async ({ page }, testInfo) => {
        await openSelectWithSelection(page, { theme, accent });
        await takeSnapshot(page, testInfo, { fullPage: false });
      });
    });
  }
}

// 文字サイズの両端と中間を狭い画面で確認する。テーマ・アクセント・コントラストも組み合わせ、
// 文字の拡大と配色の変更が同時に効いた場合を残す
for (const globals of [
  { fontSize: "small", theme: "light", accent: "blue", contrast: "default" },
  { fontSize: "medium", theme: "dark", accent: "green", contrast: "more" },
  { fontSize: "large", theme: "light", accent: "pink", contrast: "more" },
  { fontSize: "xlarge", theme: "dark", accent: "purple", contrast: "more" },
] as const) {
  test.describe(`文字サイズ（${globals.fontSize}）`, () => {
    test.use({ viewport: { width: 320, height: 800 } });

    for (const target of FONT_SIZE_STORIES) {
      test(storyTitle(target), async ({ page }, testInfo) => {
        await openStory(page, target, globals);
        await takeSnapshot(page, testInfo);
      });
    }
  });
}

// Select の候補を開き、選択中・hover 中・未選択の候補が並んだ状態にする。
// 一度「みけ」を選んでから開き直し、「くろ」にマウスを乗せる
async function openSelectWithSelection(page: Page, globals: Globals = {}) {
  await openStory(page, story("フォーム/Select", "Default"), globals);
  const trigger = page.getByRole("button", { name: /ねこ/ });
  await trigger.click();
  await page.getByRole("option", { name: "みけ" }).click();
  await expect(trigger).toContainText("みけ");
  await trigger.click();
  await expect(page.getByRole("option", { name: "みけ" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("option", { name: "くろ" }).hover();
}

// 候補・メニューのポップオーバーは表示領域に重ねて開くため、表示領域だけを撮る
test("Select の候補を開いた見た目", async ({ page }, testInfo) => {
  await openSelectWithSelection(page);
  await takeSnapshot(page, testInfo, { fullPage: false });
});

test("DropdownMenu を開いた見た目", async ({ page }, testInfo) => {
  await openStory(page, story("操作/DropdownMenu", "Primary"));
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByRole("menuitem", { name: "家を作る" }).hover();
  await takeSnapshot(page, testInfo, { fullPage: false });
});
