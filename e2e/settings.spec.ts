import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "PC", width: 1280, height: 720 },
  { name: "スマートフォン", width: 375, height: 812 },
]) {
  test(`${viewport.name}で設定から各管理ページへ移動して戻れる`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/home");
    await page.getByRole("link", { name: "設定を開く" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(
      page.getByRole("heading", { name: "設定", exact: true }),
    ).toBeVisible();

    for (const { name, path } of [
      { name: "アカウント設定", path: "/settings/account" },
      { name: "家の設定", path: "/settings/households" },
      { name: "通知設定", path: "/settings/notifications" },
      { name: "見た目設定", path: "/settings/appearance" },
      { name: "更新情報", path: "/release-notes" },
    ]) {
      await page
        .getByRole("navigation", { name: "設定メニュー" })
        .getByRole("link", { name: new RegExp(name) })
        .click();
      await expect(page).toHaveURL(path);
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "パンくずリスト" })
        .getByRole("link", { name: "設定", exact: true })
        .click();
      await expect(page).toHaveURL("/settings");
    }

    await page.goto("/cats");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "設定", exact: true })
      .click();
    await expect(page).toHaveURL("/settings");
  });
}

test("以前のプロフィール設定・ログイン設定の URL を開くと、アカウント設定へ移る", async ({
  page,
}) => {
  for (const path of ["/settings/profile", "/settings/login"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/settings/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "アカウント設定" }),
    ).toBeVisible();
  }
});
