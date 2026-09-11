import { expect, test } from "@playwright/test";

// "/" は登録済みの猫の数によって "/home" 以外へもリダイレクトされうるため、
// 他のテストと並行実行しても安定するよう "/home" に直接アクセスして確認する
test("ホームページにサービス名が表示される", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "CANSHI" })).toBeVisible();
});
