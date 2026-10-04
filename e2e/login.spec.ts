import { expect, test } from "@playwright/test";

// ログイン前の状態を確認するため、保存済みのセッションを使わない
test.use({ storageState: { cookies: [], origins: [] } });

test("未ログインでページを開くとログイン画面にリダイレクトされ、ログイン後に元のページへ戻る", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsettings$/);
  await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  // 未ログインではヘッダーの通知・設定へのリンクを出さない
  await expect(page.getByRole("link", { name: "設定" })).toHaveCount(0);

  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
});

test("未ログインでは API・メディアに 401 を返す", async ({ request }) => {
  const media = await request.get("/media/unknown-asset", {
    maxRedirects: 0,
  });
  expect(media.status()).toBe(401);

  const upload = await request.post("/api/media/uploads", { maxRedirects: 0 });
  expect(upload.status()).toBe(401);
});

test("PWA の manifest はログインなしで取得できる", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
});

test("ログアウトするとログイン画面に戻り、ページを開けなくなる", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/cats");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcats$/);
});
