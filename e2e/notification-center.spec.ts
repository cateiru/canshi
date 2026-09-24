import { expect, type Page, test } from "@playwright/test";

/**
 * 掃除の通知を発生させるため、通知時刻 00:00・頻度1日の掃除対象を作り、3日前に実施した
 * 記録を1件だけ付ける。通知時刻を 00:00 にしておくことで、テストの実行時刻に関わらず
 * 通知が生成される（掃除以外の通知は 18:00 を過ぎるまで生成されない）。
 * 生成される通知のタイトルを返す
 */
async function createOverdueCleaningTarget(page: Page): Promise<string> {
  const targetName = `水-${Date.now()}`;
  await page.getByRole("link", { name: "掃除記録" }).click();
  await page.getByRole("link", { name: "最初の対象を追加する" }).click();
  await page.getByLabel("名前").fill(targetName);
  await page.getByLabel("頻度", { exact: true }).fill("1");
  await page.getByLabel("通知時刻").click();
  await page.getByRole("option", { name: "00:00", exact: true }).click();
  await page.getByRole("button", { name: "追加する", exact: true }).click();
  await expect(page).toHaveURL(/\/cleaning$/);

  await page
    .getByRole("article", { name: targetName })
    .getByRole("link", { name: "記録を見る" })
    .click();
  await page.getByRole("link", { name: "最初の記録をする" }).click();
  const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("実施日").fill(pastDate);
  await page.getByLabel("実施時刻").fill("08:00");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/\/records$/);

  return `${targetName}のお手入れの時期です`;
}

test("通知を完了にすると対応済み一覧に移る", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  const title = await createOverdueCleaningTarget(page);
  await page.goto("/notifications");
  const card = page.locator("li").filter({ hasText: title });
  await expect(card).toBeVisible();

  // 完了にする
  await card.getByRole("button", { name: "完了にする" }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.getByRole("tab", { name: "対応済み" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: title }).getByText("完了"),
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

test("通知を延期すると未対応一覧から消える", async ({ page }) => {
  // 延期の期日到来（最短でも1日延期）までは待てないため、この E2E では
  // 「延期後に未対応一覧から消える」ことのみ確認する。到来後に再び未対応・未読として
  // 扱われることは、時刻を制御できる `src/features/notifications/queries.test.ts` の
  // 結合テストで確認している（PR #41 レビュー対応）
  const catName = `テスト猫-${Date.now()}`;
  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  const title = await createOverdueCleaningTarget(page);
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
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
});
