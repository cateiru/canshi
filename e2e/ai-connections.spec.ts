import { expect, test } from "@playwright/test";

test("AIとの接続で、読み取りを許可する記録の種類を外して保存すると、再読み込み後も保たれる", async ({
  page,
}) => {
  await page.goto("/settings/ai-connections");
  const permissions = page.getByRole("region", {
    name: "読み取りを許可する範囲",
  });
  await expect(permissions).toBeVisible();

  // ほかのテストで残った猫がいても影響しないよう、最初の猫の記録だけを操作する
  const records = permissions.getByRole("group", { name: /の記録$/ }).first();
  // Checkbox の実体（input）は視覚的に隠れておりクリック不可のため、
  // クリックは表示テキスト、状態確認は checkbox ロールに対して行う
  const poop = records.getByRole("checkbox", { name: "うんち" });
  const poopLabel = records.getByText("うんち", { exact: true });
  const save = permissions.getByRole("button", { name: "保存する" });
  await expect(poop).toBeChecked();

  await poopLabel.click();
  await expect(poop).not.toBeChecked();
  await save.click();
  await expect(
    page.getByText("読み取りを許可する範囲を保存しました"),
  ).toBeVisible();

  await page.reload();
  await expect(poop).not.toBeChecked();
  await expect(records.getByRole("checkbox", { name: "ごはん" })).toBeChecked();

  // 後続のテスト（VRT など）に影響しないよう、すべて読み取れる状態に戻す
  await poopLabel.click();
  await expect(poop).toBeChecked();
  await save.click();
  await expect(
    page.getByText("読み取りを許可する範囲を保存しました"),
  ).toBeVisible();
  await page.reload();
  await expect(poop).toBeChecked();
});
