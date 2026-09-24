import { expect, test } from "@playwright/test";

// シャンプー記録の登録・編集・削除ができることを検証する
test("シャンプー記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;
  // 経過日数の表示（0日経過）を確定させるため、実施日は「今日」を使う
  const today = new Date().toISOString().slice(0, 10);

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "シャンプー記録" }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}のシャンプー記録` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("実施日").fill(today);
  await page.getByLabel("実施時刻").fill("10:00");
  await page.getByLabel("備考").fill("いつものシャンプー");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/shampoo-records$/);
  const record = page.getByRole("article");
  await expect(record.getByText("いつものシャンプー")).toBeVisible();
  await expect(page.getByText("前回のシャンプーから0日経過")).toBeVisible();

  await page.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("備考")).toHaveValue("いつものシャンプー");
  await page.getByLabel("備考").fill("低刺激シャンプーに変更");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/shampoo-records$/);
  await expect(record.getByText("低刺激シャンプーに変更")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(
    page.getByText("まだシャンプー記録がありません。"),
  ).toBeVisible();

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
