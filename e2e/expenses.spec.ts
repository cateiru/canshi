import { expect, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

// 支出記録の登録・編集・削除ができることを検証する
test("支出記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "支出記録" }).click();
  await expect(page).toHaveURL(/\/expenses/);
  await page.getByRole("link", { name: "記録する" }).click();

  await fillAndKeep(page.getByLabel("支出日"), "2026-09-08");
  await page.getByLabel("金額（円）").fill("1980");
  await page.getByLabel("カテゴリ").click();
  await page.getByRole("option", { name: "衛生用品" }).click();
  await page.getByLabel("メモ").fill("トイレの砂を購入");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/\/expenses/);
  // 「すべての支出」には他の猫の支出も含まれ得るため、この猫だけに絞り込む
  await page.getByRole("link", { name: `${catName}のみ` }).click();

  const record = page.getByRole("article", { name: "衛生用品 1,980円" });
  await expect(record).toBeVisible();
  await expect(record.getByText(catName)).toBeVisible();
  await expect(record.getByText("トイレの砂を購入")).toBeVisible();

  await record
    .getByRole("link", { name: "衛生用品 1,980円の支出を編集する" })
    .click();
  await expect(page.getByLabel("金額（円）")).toHaveValue("1980");
  await page.getByLabel("金額（円）").fill("2500");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page).toHaveURL(/\/expenses/);
  await page.getByRole("link", { name: `${catName}のみ` }).click();
  const updatedRecord = page.getByRole("article", {
    name: "衛生用品 2,500円",
  });
  await expect(updatedRecord).toBeVisible();

  await updatedRecord.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(updatedRecord).toHaveCount(0);

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
