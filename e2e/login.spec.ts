import { expect, test } from "@playwright/test";

// ログイン前の状態を確認するため、保存済みのセッションを使わない
test.use({ storageState: { cookies: [], origins: [] } });

/** ログイン画面の URL（`/settings/login` などパスの途中に `/login` を含むページとは区別する） */
const LOGIN_PAGE_URL = /^https?:\/\/[^/]+\/login(\?|$)/;

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

test("DB にないセッションの Cookie ではログインしたことにならない", async ({
  page,
  baseURL,
}) => {
  // middleware は Cookie の有無ではなく、D1 のセッションと照合して判定する
  await page
    .context()
    .addCookies([
      { name: "canshi-session", value: "forged-session-token", url: baseURL },
    ]);

  await page.goto("/food-products");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Ffood-products$/);

  const media = await page.request.get("/media/unknown-asset", {
    maxRedirects: 0,
  });
  expect(media.status()).toBe(401);
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

  const [sessionCookie] = (await page.context().cookies()).filter(
    (cookie) => cookie.name === "canshi-session",
  );
  expect(sessionCookie).toBeDefined();

  await page.goto("/settings/account");
  // 端末一覧にもほかの端末の「ログアウト」ボタンが並ぶため、「ログアウト」の欄の中から押す
  await page
    .getByRole("region", { name: "ログアウト", exact: true })
    .getByRole("button", { name: "ログアウト", exact: true })
    .click();
  // ログイン画面の URL は `/login` を含むほかのページと区別するため、パス全体で比べる
  await expect(page).toHaveURL(LOGIN_PAGE_URL);

  await page.goto("/cats");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcats$/);

  // ログアウトでセッションを DB から削除するため、ログアウト前の Cookie を
  // 持ち出して使い回してもログインしたことにならない
  await page.context().addCookies([sessionCookie]);
  await page.goto("/cats");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcats$/);
});

test("すべての端末からログアウトすると、ほかの端末のセッションも使えなくなる", async ({
  browser,
  page,
}) => {
  // 共有の e2e ユーザーのセッションを消すと並行して動くほかのテストが失敗するため、
  // このテスト専用のメールアドレスでログインする
  const email = "e2e-logout-all-devices@example.com";
  const login = async (target: typeof page) => {
    await target.goto("/login?callbackUrl=%2Fsettings%2Faccount");
    await target.getByLabel("メールアドレス（開発用）").fill(email);
    await target.getByRole("button", { name: "ログイン" }).click();
    await expect(target).toHaveURL(/\/settings\/account$/);
  };

  // 別の端末として、Cookie を共有しない別のコンテキストでもログインしておく
  const otherDevice = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const otherPage = await otherDevice.newPage();
  await login(otherPage);
  await login(page);

  await page
    .getByRole("button", { name: "すべての端末からログアウト" })
    .click();
  await page
    .getByRole("dialog", { name: "すべての端末からログアウトしますか？" })
    .getByRole("button", { name: "すべての端末からログアウト" })
    .click();
  await expect(page).toHaveURL(LOGIN_PAGE_URL);

  await otherPage.goto("/cats");
  await expect(otherPage).toHaveURL(/\/login\?callbackUrl=%2Fcats$/);
  await otherDevice.close();
});

test("ログイン中の端末の一覧から、ほかの端末をログアウトさせられる", async ({
  browser,
  page,
}) => {
  // 共有の e2e ユーザーのセッションを消すと並行して動くほかのテストが失敗するため、
  // このテスト専用のメールアドレスでログインする
  const email = "e2e-logout-session@example.com";
  const login = async (target: typeof page) => {
    await target.goto("/login?callbackUrl=%2Fsettings%2Faccount");
    await target.getByLabel("メールアドレス（開発用）").fill(email);
    await target.getByRole("button", { name: "ログイン" }).click();
    await expect(target).toHaveURL(/\/settings\/account$/);
  };

  // 別の端末として、iPhone の Safari の User-Agent を送る別のコンテキストでもログインしておく
  const otherDevice = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  });
  const otherPage = await otherDevice.newPage();
  await login(otherPage);
  await login(page);

  const sessions = page
    .getByRole("table", { name: "ログイン中の端末" })
    .getByRole("row");
  // 前回までの実行で残ったセッションも並ぶため、件数ではなく行の中身で確かめる
  await expect(sessions.filter({ hasText: "この端末" })).toHaveCount(1);
  await expect(
    sessions.filter({ hasText: "この端末" }).getByRole("button"),
  ).toHaveCount(0);
  const otherSession = sessions.filter({ hasText: "iPhone・Safari" }).first();
  // ログイン日時の列に日時を表示する
  await expect(otherSession.getByRole("cell").first()).toHaveText(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  );

  const iphoneCount = await sessions
    .filter({ hasText: "iPhone・Safari" })
    .count();
  await otherSession.getByRole("button", { name: "ログアウト" }).click();
  await page
    .getByRole("dialog", { name: "端末をログアウトしますか？" })
    .getByRole("button", { name: "ログアウト" })
    .click();
  await expect(
    page.getByText("「iPhone・Safari」をログアウトしました"),
  ).toBeVisible();
  await expect(sessions.filter({ hasText: "iPhone・Safari" })).toHaveCount(
    iphoneCount - 1,
  );

  // ログアウトさせた端末はページを開けなくなり、この端末はログインしたまま
  await otherPage.goto("/cats");
  await expect(otherPage).toHaveURL(/\/login\?callbackUrl=%2Fcats$/);
  await page.goto("/cats");
  await expect(page).toHaveURL(/\/cats$/);
  await otherDevice.close();
});

test("別のメールアドレスでログインすると、別のユーザーになる", async ({
  page,
}) => {
  // e2e は `next dev` に対して実行するため、`/login` は開発用のログインになる
  // （Cloudflare Access を通さず、入力したメールアドレスでログインする）
  await page.goto("/login?callbackUrl=%2Fsettings%2Faccount%2Fprofile");
  await page
    .getByLabel("メールアドレス（開発用）")
    .fill("e2e-another-user@example.com");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/settings\/account\/profile$/);

  // 新しく作ったユーザーは、メールアドレスから名前を作らない
  await expect(page.getByRole("textbox", { name: "名前" })).toHaveValue(
    "ユーザー",
  );
  // 家に所属していないため、e2e のユーザーの家（オーナーの家）は見えない
  await page.goto("/settings/households");
  await expect(
    page.getByRole("link").filter({ hasText: "あなたはオーナー" }),
  ).toHaveCount(0);
});
