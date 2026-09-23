import { expect, test } from "@playwright/test";

test("通知設定（全体・猫ごと）を確認・変更できる", async ({ page }) => {
  // 全体設定：通知時刻は 18:00 固定のため、案内の表示だけ確認する
  await page.goto("/settings/notifications");
  await expect(
    page.getByText("お知らせは毎日 18:00（日本時間）に届きます。", {
      exact: false,
    }),
  ).toBeVisible();

  // 猫ごとの通知設定
  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "通知設定" }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}の通知設定` }),
  ).toBeVisible();

  await page.getByText("シャンプー経過の通知を有効にする").click();
  await page.getByLabel("経過月数").fill("3");
  await page.getByLabel("経過日数").fill("21");
  await page.getByRole("button", { name: "保存する" }).click();

  await expect(page).toHaveURL(/notification-settings$/);
  await expect(
    page.getByRole("checkbox", { name: "シャンプー経過の通知を有効にする" }),
  ).not.toBeChecked();
  await expect(page.getByLabel("経過月数")).toHaveValue("3");
  await expect(page.getByLabel("経過日数")).toHaveValue("21");

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
