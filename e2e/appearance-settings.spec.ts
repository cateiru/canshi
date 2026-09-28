import { expect, test } from "@playwright/test";

const LIGHT_BG = "rgb(255, 255, 255)";
const DARK_BG = "rgb(28, 30, 39)";

function bodyBackground(page: import("@playwright/test").Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test("見た目設定でテーマとコントラストを切り替えると、再読み込み後も保たれる", async ({
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

  // cookie の保存（Server Action）が終わってから再読み込みする
  await expect
    .poll(async () =>
      (await page.context().cookies()).map(({ name, value }) =>
        [name, value].join("="),
      ),
    )
    .toEqual(
      expect.arrayContaining(["canshi-theme=dark", "canshi-contrast=more"]),
    );
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-contrast", "more");
  await expect(page.getByRole("radio", { name: "ダーク" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "上げる" })).toBeChecked();
  expect(await bodyBackground(page)).toBe(DARK_BG);

  // 他のページにも反映される
  await page.goto("/home");
  await expect(html).toHaveAttribute("data-theme", "dark");
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
