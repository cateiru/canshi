import { expect, type Locator } from "@playwright/test";

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
