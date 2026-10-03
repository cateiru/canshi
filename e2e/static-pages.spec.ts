import { expect, test } from "@playwright/test";

// CRUD 操作を持たない静的なページの表示内容を確認する
test("更新情報ページに見出しとリリースノートが表示される", async ({ page }) => {
  await page.goto("/release-notes");
  await expect(page.getByRole("heading", { name: "更新情報" })).toBeVisible();
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("オフラインページに案内文言が表示される", async ({ page }) => {
  await page.goto("/offline");
  await expect(
    page.getByRole("heading", { name: "オフラインです" }),
  ).toBeVisible();
  await expect(
    page.getByText("インターネットに接続されていないため"),
  ).toBeVisible();
});

test("ごはん記録の記録方法のヘルプページに両モードの説明が表示される", async ({
  page,
}) => {
  await page.goto("/help/feeding-modes");
  await expect(
    page.getByRole("heading", {
      name: "「厳格モード」「あいまいモード」とは？",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "厳格モード", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "あいまいモード", exact: true }),
  ).toBeVisible();
});
