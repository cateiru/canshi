import { expect, test } from "@playwright/test";

// 猫ごとの通知設定を変更し、再訪問しても内容が保持されることを検証する
test("猫の通知設定を変更すると保存され、再訪問しても保持される", async ({
  page,
}) => {
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

  // Checkbox の実体（input）は視覚的に隠れておりクリック不可のため、
  // クリックは表示テキスト、状態確認は checkbox ロールに対して行う
  const halfYearCheckbox = page.getByRole("checkbox", {
    name: "半年ごとの節目を通知する",
  });
  await expect(halfYearCheckbox).toBeChecked();
  await page.getByText("半年ごとの節目を通知する").click();
  await expect(halfYearCheckbox).not.toBeChecked();

  await page.getByLabel("経過月数").fill("4");
  await page.getByLabel("経過日数").fill("10");
  await page.getByRole("button", { name: "保存する" }).click();

  await page.reload();
  await expect(page.getByLabel("半年ごとの節目を通知する")).not.toBeChecked();
  await expect(page.getByLabel("経過月数")).toHaveValue("4");
  await expect(page.getByLabel("経過日数")).toHaveValue("10");

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
