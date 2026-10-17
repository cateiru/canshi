import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 入力欄に値を入れ、その値が保持されていることを確認する。
 * `page.goto` 直後はハイドレーション前に入力してしまい、React が初期値で上書きすることがあるため、
 * 値が残るまで入れ直す
 */
export async function fillAndKeep(locator: Locator, value: string) {
  await expect(async () => {
    if ((await locator.inputValue()) !== value) {
      await locator.fill(value);
    }
    expect(await locator.inputValue()).toBe(value);
  }).toPass();
}

/**
 * 猫一覧のヘッダーの「追加する」メニューから、猫の登録画面を開く。
 * ハイドレーション前にボタンを押すとメニューが開かないため、メニューが開くまで押し直す
 */
export async function openCatRegistration(page: Page) {
  await page.goto("/cats");
  const menuItem = page.getByRole("menuitem", { name: "猫を登録する" });
  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await page.getByRole("button", { name: "追加する" }).click();
    }
    await expect(menuItem).toBeVisible({ timeout: 1000 });
  }).toPass();
  await menuItem.click();
  await expect(page).toHaveURL(/\/cats\/new$/);
}
