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
  const menuItem = page.getByRole("menuitem", { name: "ねこを登録する" });
  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await page.getByRole("button", { name: "追加する" }).click();
    }
    await expect(menuItem).toBeVisible({ timeout: 1000 });
  }).toPass();
  await menuItem.click();
  await expect(page).toHaveURL(/\/cats\/new$/);
}

/**
 * はじめてログインしたユーザーに出るウェルカムモーダルで「もっていない」を選ぶ。
 * モーダルが閉じてホームへ移り、はじめてガイドがはじまる。
 * ハイドレーション前に押すと反応しないため、モーダルが消えるまで押し直す
 */
export async function skipWelcomeModal(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: "アカウントを作成いただきありがとうございます！",
  });
  await expect(dialog).toBeVisible();
  await expect(async () => {
    if (await dialog.isVisible()) {
      await dialog.getByRole("button", { name: "もっていない" }).click();
    }
    await expect(dialog).toBeHidden({ timeout: 2000 });
  }).toPass();
  await expect(page).toHaveURL(/\/home$/);
}

/**
 * はじめてログインしたユーザーに出る、ウェルカムモーダルを閉じて「はじめてガイド」をやめる。
 * ウェルカムモーダルで「もっていない」を選ぶとホームへ移るため、そのあとの画面は呼び出し側で開き直す。
 * ハイドレーション前に押すと反応しないため、パネルが消えるまで押し直す
 */
export async function quitTourGuide(page: Page) {
  await skipWelcomeModal(page);
  const guide = page.getByRole("region", { name: "はじめてガイド" });
  await expect(guide).toBeVisible();
  await expect(async () => {
    if (await guide.isVisible()) {
      await guide.getByRole("button", { name: "ガイドをやめる" }).click();
    }
    await expect(guide).toBeHidden({ timeout: 1000 });
  }).toPass();
}
