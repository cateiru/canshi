import { expect, test } from "@playwright/test";

test("猫の登録・一覧表示・詳細表示・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();

  await page.getByLabel("名前").fill(catName);
  await page.getByLabel("性別").click();
  await page.getByRole("option", { name: "メス" }).click();
  await page.getByLabel("生年月日").fill("2020-04-01");
  await page.getByLabel("猫種").fill("雑種");
  await page.getByLabel("お迎え日").fill("2020-06-01");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await expect(page.getByText("メス")).toBeVisible();
  await expect(page.getByText(/歳/)).toBeVisible();
  await expect(page.getByText(/日）/)).toBeVisible();

  await page.goto("/cats");
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("link", { name: "編集する" }).click();
  await page.getByLabel("猫種").fill("三毛猫");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page.getByText("三毛猫")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();

  await expect(page).toHaveURL(/\/cats$/);
  await expect(page.getByRole("heading", { name: catName })).toHaveCount(0);
});
