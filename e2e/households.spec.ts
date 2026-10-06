import { expect, test } from "@playwright/test";

// 家の設定（名前の変更）と、猫一覧の家ごとのまとまりの開閉を検証する。
// メンバーを外す・オーナーを移譲する操作は、ログインできるユーザーが 1 人だけで
// 再現できないため、`src/features/households/management.test.ts` などで確かめる。
// 名前を変えるテストと、家の名前で開閉ボタンを探すテストが重ならないよう、直列に実行する
test.describe.configure({ mode: "serial" });

test("家の名前を変えると、家の設定と猫一覧に反映される", async ({ page }) => {
  await page.goto("/settings/households");
  await expect(
    page.getByRole("heading", { name: "家の設定", exact: true }),
  ).toBeVisible();

  const householdLink = page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" });
  await householdLink.first().click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  await expect(page.getByText("（あなた）")).toBeVisible();

  const nameField = page.getByRole("textbox", { name: "家の名前" });
  const originalName = await nameField.inputValue();
  const newName = `テストの家-${Date.now()}`;

  try {
    await nameField.fill(newName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("家の名前を保存しました");
    await expect(
      page.getByRole("heading", { level: 1, name: newName }),
    ).toBeVisible();

    await page.goto("/cats");
    await expect(page.getByRole("button", { name: newName })).toBeVisible();
  } finally {
    // 同じローカル DB を使う他のテストに影響しないよう、元の名前に戻す
    await page.goto("/settings/households");
    await page.getByRole("link").filter({ hasText: newName }).click();
    await page.getByRole("textbox", { name: "家の名前" }).fill(originalName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("家の名前を保存しました");
  }
});

test("家の名前を空にすると保存できない", async ({ page }) => {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();

  await page.getByRole("textbox", { name: "家の名前" }).fill(" ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("家の名前を入力してください")).toBeVisible();
});

test("猫一覧の家のまとまりを折りたたむと、開き直すまで折りたたんだままになる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;

  // 猫の登録先は、家の設定の一覧で先頭に表示される家（最初に所属した家）
  await page.goto("/settings/households");
  const householdName = await page
    .getByRole("navigation", { name: "パンくずリスト" })
    .locator("xpath=following::h2[1]")
    .innerText();

  // 一覧に家のまとまりが表示されるよう、猫を 1 匹登録しておく
  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.goto("/cats");
  const catHeading = page.getByRole("heading", { name: catName });
  // 開閉ボタンの名前には、家の名前に続けて猫の頭数が入る
  const trigger = page.getByRole("button", {
    name: new RegExp(
      `^${householdName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\d+匹$`,
    ),
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(catHeading).toBeVisible();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(catHeading).toBeHidden();

  // 開閉状態は localStorage に保存され、ページを開き直しても折りたたんだまま
  await page.reload();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(catHeading).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(catHeading).toBeVisible();

  // 後片付け: 登録した猫を削除する
  await catHeading.click();
  await page.getByRole("button", { name: "削除する" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(catName);
  await dialog.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/cats$/);
});
