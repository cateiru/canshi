import { expect, test } from "@playwright/test";

test("通知を完了にすると対応済み一覧に移る", async ({ page }) => {
  // 通知時刻を 00:00 にして、テスト実行時刻に関わらず通知が生成されるようにする
  // （generateNotifications は notification_preferences.notify_time を過ぎるまで生成しない）
  await page.goto("/settings/notifications");
  await page.getByLabel("通知時刻").fill("00:00");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);

  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  // 体重測定の提案（既定 14 日）を発生させるため、20日前の記録を1件だけ作る
  await page.getByRole("link", { name: "体重記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  const pastDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("発生日").fill(pastDate);
  await page.getByLabel("発生時刻").fill("08:00");
  await page.getByText("猫の体重を直接入力").click();
  await page.getByLabel("猫の体重（kg）").fill("4.2");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/weight-records$/);

  const title = `${catName}の体重測定のお願い`;
  await page.goto("/notifications");
  const card = page.locator("li").filter({ hasText: title });
  await expect(card).toBeVisible();

  // 完了にする
  await card.getByRole("button", { name: "完了にする" }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.getByRole("tab", { name: "対応済み" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("完了")).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});

test("通知を延期すると未対応一覧から消える", async ({ page }) => {
  // 延期の期日到来（最短でも1日延期）までは待てないため、この E2E では
  // 「延期後に未対応一覧から消える」ことのみ確認する。到来後に再び未対応・未読として
  // 扱われることは、時刻を制御できる `src/features/notifications/queries.test.ts` の
  // 結合テストで確認している（PR #41 レビュー対応）
  await page.goto("/settings/notifications");
  await page.getByLabel("通知時刻").fill("00:00");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);

  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  // 体重測定の提案（既定 14 日）を発生させるため、20日前の記録を1件だけ作る
  await page.getByRole("link", { name: "体重記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  const pastDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("発生日").fill(pastDate);
  await page.getByLabel("発生時刻").fill("08:00");
  await page.getByText("猫の体重を直接入力").click();
  await page.getByLabel("猫の体重（kg）").fill("4.2");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/weight-records$/);

  const title = `${catName}の体重測定のお願い`;
  await page.goto("/notifications");
  const card = page.locator("li").filter({ hasText: title });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "1日延期" }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  // 延期中は「対応済み」（完了・無視のみ）にも現れない
  await page.getByRole("tab", { name: "対応済み" }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
