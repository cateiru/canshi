import { expect, test } from "@playwright/test";

// CRUD 操作を持たない静的なページの表示内容を確認する
test("更新情報ページに見出しとリリースノートが表示される", async ({ page }) => {
  await page.goto("/release-notes");
  // リリースノートの見出しにも「更新情報」を含むものがあるため、ページの見出しと完全一致で探す
  await expect(
    page.getByRole("heading", { name: "更新情報", exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("table", {
      name: "厳格モードとあいまいモードでできることの比較",
    }),
  ).toBeVisible();
});

test("ごはんプリセットのヘルプページから、家のプリセットの登録・一覧へ進める", async ({
  page,
}) => {
  await page.goto("/help/feeding-presets?householdId=household-1");
  await expect(
    page.getByRole("heading", { name: "「ごはんプリセット」とは？" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "プリセットを登録する" }),
  ).toHaveAttribute("href", "/feeding-presets/new?householdId=household-1");
  await expect(
    page.getByRole("link", { name: "プリセット一覧を見る" }),
  ).toHaveAttribute("href", "/feeding-presets?householdId=household-1");
});

test("ホームからヘルプを開き、記事を読める", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: /ヘルプを見る/ }).click();
  await expect(page).toHaveURL("/help");
  await expect(
    page.getByRole("heading", { level: 1, name: "ヘルプ" }),
  ).toBeVisible();

  await page.getByRole("link", { name: /うんち記録/ }).click();
  await expect(page).toHaveURL("/help/records/poop-records");
  await expect(
    page.getByRole("heading", { level: 1, name: "うんち記録" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /うんちを記録する画面/ }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "パンくずリスト" })
    .getByRole("link", { name: "記録のつけ方" })
    .click();
  await expect(page).toHaveURL("/help/records");
});

test("ログイン中は、ヘルプの手順から自分の家の画面へ進める", async ({
  page,
}) => {
  await page.goto("/help/create-household");
  await expect(
    page.getByRole("link", { name: "家を作成する", exact: true }),
  ).toHaveAttribute("href", "/settings/households/new");

  await page.goto("/help/add-cat");
  await expect(
    page.getByRole("link", { name: /にねこを登録する$/ }).first(),
  ).toHaveAttribute("href", /^\/cats\/new\?householdId=/);

  await page.goto("/help/notifications");
  await page.getByRole("link", { name: "通知設定", exact: true }).click();
  await expect(page).toHaveURL("/settings/notifications");
});

test.describe("ログインしていないとき", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("ヘルプはログインしなくても見られる", async ({ page }) => {
    await page.goto("/help/create-household");
    await expect(page).toHaveURL("/help/create-household");
    await expect(
      page.getByRole("heading", { level: 1, name: "家の作り方・家族の招待" }),
    ).toBeVisible();
    // 自分の家の画面への導線は、ログインしていないときは出さない
    await expect(
      page.getByRole("link", { name: "家を作成する", exact: true }),
    ).toHaveCount(0);
  });
});
