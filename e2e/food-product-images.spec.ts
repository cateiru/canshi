import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";
import { fillAndKeep } from "./helpers";

function png(color: [number, number, number, number]) {
  return Buffer.from(createPng(300, 300, () => color));
}

// ごはん商品に画像を 1 枚登録・差し替え・削除でき、ごはん記録フォーム・プリセットで商品画像が表示されることを検証する
test("ごはん商品の画像を登録・差し替え・削除できる", async ({ page }) => {
  const productName = `テスト商品-${Date.now()}`;

  await page.goto("/food-products/new");
  await fillAndKeep(page.getByLabel("商品名"), productName);
  await fillAndKeep(page.getByLabel("カロリー（kcal/100g）"), "380");
  await fillAndKeep(page.getByLabel("内容量（g）"), "1500");
  await page.getByLabel("商品画像").setInputFiles({
    name: "package-1.png",
    mimeType: "image/png",
    buffer: png([220, 120, 40, 255]),
  });
  await expect(page.getByRole("img", { name: "package-1.png" })).toBeVisible();
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await expect(page).toHaveURL(/food-products$/);

  // 一覧に商品画像が表示される
  const listImage = page.getByRole("img", { name: `${productName}の画像` });
  await expect(listImage).toBeVisible();
  const firstSrc = (await listImage.getAttribute("src")) ?? "";
  expect(firstSrc).toMatch(/^\/media\/[^/]+\/thumbnail$/);

  // ごはん記録フォームの商品選択にも商品画像が表示される
  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  const detailUrl = page.url();
  await page.goto(`${detailUrl}/feeding-records/new`);
  await page.getByLabel("商品", { exact: true }).first().click();
  await page.getByRole("option", { name: productName }).click();
  await expect(
    page.getByRole("img", { name: `${productName}の画像` }).first(),
  ).toHaveAttribute("src", firstSrc);

  // プリセット一覧にも表示される
  await page.goto("/feeding-presets/new");
  await fillAndKeep(
    page.getByLabel("プリセット名"),
    `プリセット-${Date.now()}`,
  );
  await page.getByLabel("商品", { exact: true }).first().click();
  await page.getByRole("option", { name: productName }).click();
  await fillAndKeep(page.getByLabel("与える量（g）").first(), "30");
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await expect(page).toHaveURL(/feeding-presets$/);
  await expect(
    page.getByRole("img", { name: `${productName}の画像` }).first(),
  ).toHaveAttribute("src", firstSrc);
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();

  // 差し替えると旧画像は削除される
  await page.goto("/food-products");
  await page
    .getByRole("heading", { name: productName })
    .locator("..")
    .getByRole("link", { name: "編集する" })
    .click();
  await page.getByLabel("商品画像").setInputFiles({
    name: "package-2.png",
    mimeType: "image/png",
    buffer: png([40, 120, 220, 255]),
  });
  await expect(page.getByRole("img", { name: "package-2.png" })).toBeVisible();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/food-products$/);
  const secondSrc =
    (await page
      .getByRole("img", { name: `${productName}の画像` })
      .getAttribute("src")) ?? "";
  expect(secondSrc).not.toBe(firstSrc);
  expect((await page.request.get(firstSrc)).status()).toBe(404);
  expect((await page.request.get(secondSrc)).status()).toBe(200);

  // 商品を削除すると画像も削除される
  await page
    .getByRole("heading", { name: productName })
    .locator("..")
    .getByRole("button", { name: "削除する" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByRole("heading", { name: productName })).toHaveCount(0);
  expect((await page.request.get(secondSrc)).status()).toBe(404);

  await page.goto(detailUrl);
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
