import { expect, test } from "@playwright/test";

// ごはんプリセット一覧での編集・削除ができることを検証する（新規作成とごはん記録での利用は feeding-records.spec.ts で検証済み）
test("ごはんプリセットの編集・削除ができる", async ({ page }) => {
  const productName = `プリセット用商品-${Date.now()}`;
  const presetName = `テストプリセット-${Date.now()}`;

  await page.goto("/food-products/new");
  await page.getByLabel("商品名").fill(productName);
  await page.getByLabel("カロリー（kcal/100g）").fill("100");
  await page.getByLabel("内容量（g）").fill("500");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/food-products$/);

  await page.goto("/feeding-presets/new");
  await page.getByLabel("プリセット名").fill(presetName);
  await page.getByLabel("商品", { exact: true }).click();
  await page.getByRole("option", { name: productName }).click();
  await page.getByLabel("与える量（g）").fill("30");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page).toHaveURL(/feeding-presets$/);
  const preset = page.getByRole("article", { name: presetName });
  await expect(preset).toBeVisible();
  await expect(preset.getByText(productName)).toBeVisible();
  await expect(preset.getByText("30")).toBeVisible();

  await preset.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("プリセット名")).toHaveValue(presetName);
  await page.getByLabel("与える量（g）").fill("45");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page).toHaveURL(/feeding-presets$/);
  await expect(preset.getByText("45")).toBeVisible();

  await preset.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByRole("article", { name: presetName })).toHaveCount(0);
});
