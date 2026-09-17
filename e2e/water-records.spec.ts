import { expect, test } from "@playwright/test";

test("水の記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "水の記録" }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}の水の記録` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("発生日").fill("2026-09-07");
  await page.getByLabel("発生時刻").fill("08:00");
  await page.getByLabel("秤").click();
  await page.getByLabel("給水量（ml）").fill("200");
  await page.getByLabel("残量（ml）").fill("50");
  await page.getByLabel("こぼれがあった").click();
  await page.getByLabel("水を交換した").click();
  await page.getByLabel("主観評価").click();
  await page.getByRole("option", { name: "多い" }).click();
  await page.getByLabel("備考").fill("よく飲んでいた");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/water-records$/);
  const record = page.getByRole("article");
  await expect(record.getByText("200")).toBeVisible();
  await expect(record.getByText("秤")).toBeVisible();
  await expect(record.getByText("あり")).toBeVisible();
  await expect(record.getByText("多い")).toBeVisible();
  await expect(record.getByText("よく飲んでいた")).toBeVisible();

  await page.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("給水量（ml）")).toHaveValue("200");
  await page.getByLabel("給水量（ml）").fill("180");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/water-records$/);
  await expect(record.getByText("180")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ水の記録がありません。")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
