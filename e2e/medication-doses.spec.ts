import { expect, test } from "@playwright/test";

// 服薬予定に対する投薬実績（doses）の登録・編集・削除を検証する
test("投薬実績の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "服薬記録" }).click();
  await page
    .getByRole("link", { name: "服薬予定を登録する", exact: true })
    .click();
  await page.getByLabel("薬名").fill("抗生剤");
  await page.getByLabel("1回量").fill("1錠");
  await page.getByLabel("1日あたりの回数").fill("2");
  await page.getByLabel("服用開始日").fill("2026-09-01");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/medications$/);

  await page.getByRole("link", { name: "投薬実績を見る" }).click();
  await expect(page.getByText("まだ投薬実績がありません。")).toBeVisible();
  await page.getByRole("link", { name: "最初の実績を記録する" }).click();

  await page.getByLabel("投薬日").fill("2026-09-08");
  await page.getByLabel("投薬時刻").fill("08:00");
  // Checkbox の実体（input）は視覚的に隠れておりクリック不可のため、表示テキストをクリックする
  await page.getByText("投薬できた").click();
  await page.getByLabel("備考").fill("嫌がらず飲めた");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/doses$/);
  const dose = page.getByRole("article");
  await expect(dose.getByText("投薬できなかった")).toBeVisible();
  await expect(dose.getByText("嫌がらず飲めた")).toBeVisible();

  await dose.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("備考")).toHaveValue("嫌がらず飲めた");
  await page.getByText("投薬できた").click();
  await page.getByLabel("備考").fill("問題なく投薬できた");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page).toHaveURL(/doses$/);
  await expect(dose.getByText("投薬できた", { exact: true })).toBeVisible();
  await expect(dose.getByText("問題なく投薬できた")).toBeVisible();

  await dose.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ投薬実績がありません。")).toBeVisible();

  // 後片付け（猫の削除）
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
