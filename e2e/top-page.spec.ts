import { expect, test } from "@playwright/test";

test("トップページにサービス名が表示される", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CANSHI" })).toBeVisible();
});
