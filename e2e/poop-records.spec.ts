import { expect, test } from "@playwright/test";

test("うんち記録の登録から一覧表示までできる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();

  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await page.getByRole("link", { name: "うんち記録" }).click();

  await expect(
    page.getByRole("heading", { name: `${catName}のうんち記録` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("発生日").fill("2026-09-07");
  await page.getByLabel("発生時刻").fill("08:00");
  await page.getByLabel("回数").fill("2");
  await page.getByText("柔らかい").click();
  await page.getByLabel("量").fill("多め");
  await page.getByLabel("色").fill("茶色");
  await page.getByText("血液が混じっていた").click();
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/poop-records$/);
  await expect(page.getByText("2回")).toBeVisible();
  await expect(page.getByText("柔らかい")).toBeVisible();
  await expect(page.getByText("多め")).toBeVisible();
  await expect(page.getByText("茶色")).toBeVisible();
  await expect(page.getByText("血液あり")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
