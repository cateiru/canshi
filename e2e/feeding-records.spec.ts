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
  const summary = page.getByLabel("食事の合計（推定）");
  await expect(summary).toContainText("60g");
  await expect(summary).toContainText("112.0kcal");

  await page.getByRole("link", { name: "編集する", exact: true }).click();
  await expect(page.getByLabel("与えた量（g）").first()).toHaveValue("45");
  await expect(page.getByLabel("残した量（g）").first()).toHaveValue("5");
  await page.getByRole("button", { name: "商品 2を削除" }).click();
  await expect(page.getByLabel("与えた量（g）")).toHaveCount(1);
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/feeding-records$/);
  await expect(summary).toContainText("40g");
  await expect(summary).toContainText("36.0kcal");

  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "キャンセル" })
    .click();
  await expect(summary).toBeVisible();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだごはん記録がありません。")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});

test("あいまいモードのプリセットからごはんを段階で記録できる", async ({
  page,
}) => {
  const catName = `あいまい猫-${Date.now()}`;
  const productName = `あいまい用カリカリ-${Date.now()}`;
  const presetName = `あいまいセット-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.goto("/food-products/new");
  await page.getByLabel("商品名").fill(productName);
  await page.getByLabel("カロリー（kcal/100g）").fill("380");
  await page.getByLabel("内容量（g）").fill("1500");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/food-products$/);

  await page.goto("/feeding-presets/new");
  await page.getByLabel("プリセット名").fill(presetName);
  await page.getByRole("radio", { name: "あいまいモード" }).click();
  await page.getByLabel("商品", { exact: true }).click();
  await page.getByRole("option", { name: productName }).click();
  await page
    .getByRole("radiogroup", { name: "与える量" })
    .getByText("少なめ", { exact: true })
    .click();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/feeding-presets$/);
  const preset = page.getByRole("article", { name: presetName });
  await expect(preset.getByText("あいまいモード")).toBeVisible();
  await expect(preset.getByText("少なめ", { exact: true })).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("link", { name: "ごはん記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();

  await expect(page.getByRole("radio", { name: "厳格モード" })).toBeChecked();
  await page.getByRole("button", { name: presetName }).click();
  await expect(
    page.getByRole("radio", { name: "あいまいモード" }),
  ).toBeChecked();
  await expect(page.getByLabel("与えた量（g）")).toHaveCount(0);
  await expect(
    page
      .getByRole("radiogroup", { name: "与えた量" })
      .getByRole("radio", { name: "少なめ" }),
  ).toBeChecked();
  await page
    .getByRole("radiogroup", { name: "残した量" })
    .getByText("少し残し", { exact: true })
    .click();
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/feeding-records$/);
  await expect(page.getByText(productName)).toBeVisible();
  await expect(page.getByText("あいまいモード")).toBeVisible();
  await expect(page.getByText("少なめ", { exact: true })).toBeVisible();
  await expect(page.getByText("少し残し", { exact: true })).toBeVisible();
  // あいまいモードは食べた量・カロリーを計算しないため、合計とグラフを表示しない
  await expect(page.getByLabel("食事の合計（推定）")).toHaveCount(0);
  await expect(page.getByText("ごはんの推移")).toHaveCount(0);

  await page.getByRole("link", { name: "編集する", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "あいまいモード" }),
  ).toBeChecked();
  await expect(
    page
      .getByRole("radiogroup", { name: "残した量" })
      .getByRole("radio", { name: "少し残し" }),
  ).toBeChecked();

  await page
    .getByRole("link", { name: "「厳格モード」「あいまいモード」とは？" })
    .click();
  await expect(page).toHaveURL(/help\/feeding-modes$/);
  await expect(
    page.getByRole("heading", {
      name: "「厳格モード」「あいまいモード」とは？",
    }),
  ).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
