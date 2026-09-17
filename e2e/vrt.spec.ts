import { expect, takeSnapshot, test } from "@chromatic-com/playwright";

// ビジュアルリグレッションテスト (Chromatic)。
// 動的データ (日時・アップロード画像等) を含まない静的なページのみを対象にする。

test("コンポーネントプレビューページの見た目", async ({ page }, testInfo) => {
  await page.goto("/dev/components");
  await expect(
    page.getByRole("heading", { name: "コンポーネントプレビュー" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("オフラインページの見た目", async ({ page }, testInfo) => {
  await page.goto("/offline");
  await expect(
    page.getByRole("heading", { name: "オフラインです" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});
