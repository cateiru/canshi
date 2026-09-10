import { expect, test } from "@playwright/test";

test("複数商品のごはん記録とプリセットからの自動入力ができる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;
  const wetProductName = `ウェットNg-${Date.now()}`;
  const dryProductName = `カリカリNg-${Date.now()}`;
  const presetName = `朝ごはんセット-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.goto("/food-products/new");
  await page.getByLabel("商品名").fill(wetProductName);
  await page.getByLabel("カロリー（kcal/100g）").fill("90");
  await page.getByLabel("内容量（g）").fill("85");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/food-products$/);

  await page.goto("/food-products/new");
  await page.getByLabel("商品名").fill(dryProductName);
  await page.getByLabel("カロリー（kcal/100g）").fill("380");
  await page.getByLabel("内容量（g）").fill("1500");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/food-products$/);

  await page.goto("/feeding-presets/new");
  await page.getByLabel("プリセット名").fill(presetName);
  await page.getByLabel("商品", { exact: true }).first().click();
  await page.getByRole("option", { name: wetProductName }).click();
  await page.getByLabel("与える量（g）").fill("45");
  await page.getByRole("button", { name: "商品を追加する" }).click();
  await page.getByLabel("商品", { exact: true }).nth(1).click();
  await page.getByRole("option", { name: dryProductName }).click();
  await page.getByLabel("与える量（g）").nth(1).fill("20");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/feeding-presets$/);
  await expect(page.getByText(presetName)).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("link", { name: "ごはん記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByRole("button", { name: presetName }).click();

  await expect(page.getByLabel("与えた量（g）").first()).toHaveValue("45");
  await expect(page.getByLabel("与えた量（g）").nth(1)).toHaveValue("20");

  await page.getByLabel("残した量（g）").first().fill("5");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/feeding-records$/);
  await expect(page.getByText(wetProductName)).toBeVisible();
  await expect(page.getByText(dryProductName)).toBeVisible();
  await expect(page.getByText("推定摂取量（合計）")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
