import { expect, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

const LIGHT_BG = "rgb(255, 255, 255)";
const DARK_BG = "rgb(28, 30, 39)";

function bodyBackground(page: import("@playwright/test").Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test("見た目設定でテーマ・コントラスト・アクセントカラーを切り替えると、再読み込み後も保たれる", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page
    .getByRole("navigation", { name: "設定メニュー" })
    .getByRole("link", { name: /見た目設定/ })
    .click();
  await expect(page).toHaveURL("/settings/appearance");
  await expect(
    page.getByRole("heading", { name: "見た目設定", exact: true }),
  ).toBeVisible();

  const html = page.locator("html");
  await expect(page.getByRole("radio", { name: "システム" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "デフォルト" })).toBeChecked();
  await expect(html).toHaveAttribute("data-theme", "system");
  expect(await bodyBackground(page)).toBe(LIGHT_BG);

  await page.getByRole("radio", { name: "ダーク" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => bodyBackground(page)).toBe(DARK_BG);

  await page.getByRole("radio", { name: "上げる" }).click();
  await expect(html).toHaveAttribute("data-contrast", "more");

  await page
    .getByRole("radiogroup", { name: "アクセントカラー" })
    .getByTitle("ブルー")
    .click();
  await expect(html).toHaveAttribute("data-accent", "blue");

  await page.getByRole("radio", { name: "特大", exact: true }).click();
  await expect(html).toHaveAttribute("data-font-size", "xlarge");

  // cookie の保存（Server Action）が終わってから再読み込みする
  await expect
    .poll(async () =>
      (await page.context().cookies()).map(({ name, value }) =>
        [name, value].join("="),
      ),
    )
    .toEqual(
      expect.arrayContaining([
        "canshi-theme=dark",
        "canshi-contrast=more",
        "canshi-accent=blue",
        "canshi-font-size=xlarge",
      ]),
    );
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-contrast", "more");
  await expect(html).toHaveAttribute("data-accent", "blue");
  await expect(html).toHaveAttribute("data-font-size", "xlarge");
  await expect(page.getByRole("radio", { name: "ダーク" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "ブルー" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "上げる" })).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "特大", exact: true }),
  ).toBeChecked();
  expect(await bodyBackground(page)).toBe(DARK_BG);

  // 他のページにも反映される
  await page.goto("/home");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-font-size", "xlarge");
});

test("文字サイズに合わせてプロフィール画像が拡大縮小し、日付・時刻の入力欄も収まる", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const catName = `見た目確認猫-${Date.now()}`;
  await page.goto("/cats/new");
  await fillAndKeep(page.getByLabel("名前"), catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  const detailUrl = page.url();

  for (const [fontSize, scale] of [
    ["small", 0.9],
    ["medium", 1],
    ["large", 1.15],
    ["xlarge", 1.3],
  ] as const) {
    await page
      .context()
      .addCookies([
        { name: "canshi-font-size", value: fontSize, url: baseURL },
      ]);
    for (const [url, size] of [
      ["/cats", 64],
      [detailUrl, 112],
      [`${detailUrl}/edit`, 112],
    ] as const) {
      await page.goto(url);
      const avatar = page.getByRole("img", { name: `${catName}の画像なし` });
      await expect(avatar).toBeVisible();
      // 枠線を含むプロフィール画像全体の寸法を確認する
      const bounds = await avatar.locator("..").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.width, `${url}・${fontSize}`).toBeCloseTo(size * scale, 1);
      expect(bounds?.height, `${url}・${fontSize}`).toBeCloseTo(
        size * scale,
        1,
      );
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
    }

    await page.goto(`${detailUrl}/water-records/new`);
    const date = await page.getByLabel("記録日", { exact: true }).boundingBox();
    const time = await page
      .getByLabel("記録時刻", { exact: true })
      .boundingBox();
    expect(date).not.toBeNull();
    expect(time).not.toBeNull();
    // 幅320pxでは縦に並び、日付全体とカレンダーのアイコンが収まる幅を保つ
    expect(date?.width).toBeGreaterThanOrEqual(200);
    expect(time?.y).toBeGreaterThanOrEqual(
      (date?.y ?? 0) + (date?.height ?? 0),
    );
    expect((date?.x ?? 0) + (date?.width ?? 0)).toBeLessThanOrEqual(320);

    await page.setViewportSize({ width: 1280, height: 800 });
    const wideDate = await page
      .getByLabel("記録日", { exact: true })
      .boundingBox();
    const wideTime = await page
      .getByLabel("記録時刻", { exact: true })
      .boundingBox();
    expect(wideDate?.y).toBe(wideTime?.y);
    await page.setViewportSize({ width: 320, height: 800 });
  }
});

for (const fontSize of ["small", "medium", "large", "xlarge"]) {
  test(`幅320px・文字サイズ${fontSize}でも見た目設定の選択肢が分割・欠落しない`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page
      .context()
      .addCookies([
        { name: "canshi-font-size", value: fontSize, url: baseURL },
      ]);
    await page.goto("/settings/appearance");
    const labels = await page
      .locator(
        '[aria-label="テーマ"] button, [aria-label="コントラスト"] button, [aria-label="文字サイズ"] button',
      )
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const bounds = button.getBoundingClientRect();
          return {
            label: button.textContent,
            lines: range.getClientRects().length,
            fits: text.left >= bounds.left && text.right <= bounds.right,
            inViewport: bounds.left >= 0 && bounds.right <= innerWidth,
          };
        }),
      );
    expect(labels).toHaveLength(9);
    for (const label of labels) {
      expect(label.lines, label.label ?? "").toBe(1);
      expect(label.fits, label.label ?? "").toBe(true);
      expect(label.inViewport, label.label ?? "").toBe(true);
    }
  });
}

test("文字サイズを変えるとボタン・選択欄・カレンダーの目印も拡大縮小する", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [fontSize, scale] of [
    ["small", 0.9],
    ["medium", 1],
    ["large", 1.15],
    ["xlarge", 1.3],
  ] as const) {
    await page
      .context()
      .addCookies([
        { name: "canshi-font-size", value: fontSize, url: baseURL },
      ]);
    await page.goto("/dev/components");
    const checkbox = page.locator("label").filter({
      has: page.getByRole("checkbox", { name: "ドライフード", exact: true }),
    });
    const radio = page.locator("label").filter({
      has: page.getByRole("radio", { name: "メス", exact: true }),
    });
    for (const [name, icon, width, height] of [
      [
        "追加メニュー",
        page
          .getByRole("button", { name: "追加する", exact: true })
          .locator("svg"),
        18,
        18,
      ],
      [
        "月送り",
        page.getByRole("link", { name: "前の月", exact: true }).locator("svg"),
        18,
        18,
      ],
      [
        "選択欄の矢印",
        page.getByRole("button", { name: /性別/ }).locator("svg"),
        10,
        6,
      ],
      [
        "チェックボックス",
        checkbox.locator('span[aria-hidden="true"]'),
        18,
        18,
      ],
      ["ラジオ", radio.locator('span[aria-hidden="true"]'), 18, 18],
      [
        "カレンダーの凡例",
        page.locator('li > svg[data-record-type="feeding"]').first(),
        14,
        14,
      ],
    ] as const) {
      const bounds = await icon.boundingBox();
      expect(bounds?.width, `${name}・${fontSize}`).toBeCloseTo(
        width * scale,
        1,
      );
      expect(bounds?.height, `${name}・${fontSize}`).toBeCloseTo(
        height * scale,
        1,
      );
    }
  }
});

test("特大文字でも狭い画面のプロフィール名とIDに十分な幅を確保する", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "canshi-font-size", value: "xlarge", url: baseURL }]);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/settings/account");
  const profile = page.getByRole("region", {
    name: "プロフィール",
    exact: true,
  });
  const details = profile.locator("dl");
  const edit = profile.getByRole("link", { name: "編集", exact: true });
  const narrowDetails = await details.boundingBox();
  const narrowEdit = await edit.boundingBox();
  expect(narrowDetails?.width).toBeGreaterThanOrEqual(240);
  expect(narrowDetails?.y).toBeGreaterThanOrEqual(
    (narrowEdit?.y ?? 0) + (narrowEdit?.height ?? 0),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  const wideDetails = await details.boundingBox();
  const wideEdit = await edit.boundingBox();
  expect(wideDetails?.x).toBeLessThan(wideEdit?.x ?? 0);
  expect((wideDetails?.x ?? 0) + (wideDetails?.width ?? 0)).toBeLessThanOrEqual(
    wideEdit?.x ?? 0,
  );
});

test("全テーマ・アクセントカラー・コントラストの組み合わせで文字と操作の目印を読み取れる", async ({
  page,
}) => {
  await page.goto("/settings/appearance");
  const results = await page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("色の確認に必要な Canvas を作れませんでした");

    function luminance(token: string) {
      probe.style.backgroundColor = `var(${token})`;
      if (!context) throw new Error("Canvas がありません");
      context.fillStyle = getComputedStyle(probe).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const rgb = context.getImageData(0, 0, 1, 1).data;
      return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
        const value = rgb[i] / 255;
        return (
          sum +
          weight *
            (value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4)
        );
      }, 0);
    }

    const results = [];
    for (const theme of ["light", "dark"]) {
      for (const accent of ["orange", "blue", "green", "pink", "purple"]) {
        for (const contrast of ["default", "more"]) {
          Object.assign(document.documentElement.dataset, {
            theme,
            accent,
            contrast,
          });
          const pairs: [string, string, number][] = [
            ["--color-ink", "--color-bg", 4.5],
            ["--color-ink-muted", "--color-bg", 4.5],
            ["--color-ink-subtle", "--color-bg", 4.5],
            ["--color-accent-strong", "--color-bg", 4.5],
            ["--color-on-accent", "--color-accent", 4.5],
            ["--color-border-input", "--color-bg", 3],
          ];
          if (contrast === "more")
            pairs.push(["--color-border", "--color-bg", 3]);
          for (const [foreground, background, minimum] of pairs) {
            const a = luminance(foreground);
            const b = luminance(background);
            results.push({
              label: `${theme}・${accent}・${contrast}・${foreground}`,
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
              minimum,
            });
          }
        }
      }
    }
    probe.remove();
    return results;
  });
  for (const result of results) {
    expect(result.ratio, result.label).toBeGreaterThanOrEqual(result.minimum);
  }
});

test("システムを選ぶと端末の設定に合わせてライト・ダークが変わる", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings/appearance");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  expect(await bodyBackground(page)).toBe(DARK_BG);

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BG);

  await page.getByRole("radio", { name: "ライト" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BG);
});
