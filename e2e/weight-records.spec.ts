import { expect, test } from "@playwright/test";

// 体重記録の登録・一覧表示・編集・削除ができることを検証する
test("体重記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "体重記録" }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}の体重記録` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("発生日").fill("2026-09-07");
  await page.getByLabel("発生時刻").fill("08:00");
  await page.getByLabel("猫の体重を直接入力").click();
  await page.getByLabel("猫の体重（kg）").fill("4.20");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/weight-records$/);
  const record = page.getByRole("article");
  await expect(record.getByText("4.20")).toBeVisible();
  await expect(record.getByText("直接入力")).toBeVisible();

  await page.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("猫の体重（kg）")).toHaveValue("4.2");
  await page.getByLabel("猫の体重（kg）").fill("4.35");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/weight-records$/);
  await expect(record.getByText("4.35")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ体重記録がありません。")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
