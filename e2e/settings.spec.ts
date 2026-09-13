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
      { name: "通知設定", path: "/settings/notifications" },
      { name: "ごはん商品一覧", path: "/food-products" },
      { name: "ごはんプリセット一覧", path: "/feeding-presets" },
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
