import { expect, takeSnapshot, test } from "../e2e/vrt-snapshot";

// 管理画面（packages/admin）のビジュアルリグレッションテスト (reg-suit)。
//
// メインアプリの VRT と同じ固定フィクスチャ (e2e/fixtures/vrt-seed.sql) を使う。ローカルで
// 実行する場合は `pnpm db:migrate:local && pnpm vrt:seed` を先に実行しておくこと
// （CI の vrt-admin ジョブでは自動的に実行される）。ローカルの D1 に e2e などで作った
// データが残っていると、その分も一覧に表示される。
//
// 書き込み（ログアウトさせる・メンバーの追加・削除・共通のごはん商品の登録・リクエストの完了など）はデータを変えてしまうため実行せず、
// 結果の表示はリダイレクト先の URL のクエリで再現する（packages/admin/src/app.tsx）

const PAGES = [
  { title: "概要", path: "/" },
  { title: "ユーザー", path: "/users" },
  { title: "家", path: "/households" },
  { title: "共通のごはん商品", path: "/food-products" },
  { title: "共通のごはん商品を登録する", path: "/food-products/new" },
  { title: "共通のごはん商品のリクエスト", path: "/food-product-requests" },
] as const;

for (const viewport of [
  { name: "PC", width: 1280, height: 800 },
  // 表は狭い画面でも縮めず横にスクロールさせるため、スマートフォンの幅でも撮る
  { name: "スマートフォン", width: 390, height: 844 },
]) {
  test.describe(viewport.name, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const page of PAGES) {
      test(`${page.title}の見た目`, async ({ page: browserPage }, testInfo) => {
        await browserPage.goto(page.path);
        await expect(
          browserPage.getByRole("heading", { level: 2, name: page.title }),
        ).toBeVisible();
        await takeSnapshot(browserPage, testInfo);
      });
    }
  });
}

test("すべての端末からログアウトさせた結果の見た目", async ({
  page,
}, testInfo) => {
  await page.goto("/users?loggedOut=vrt-inviter");
  await expect(page.getByRole("status")).toHaveText(
    "VRT招待者 をすべての端末からログアウトさせました。",
  );
  await takeSnapshot(page, testInfo);
});

test("家にメンバーを追加した結果の見た目", async ({ page }, testInfo) => {
  await page.goto(
    "/households?memberChange=added&household=vrt-household&user=vrt-inviter",
  );
  await expect(page.getByRole("status")).toContainText(
    "メンバーに追加しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("家にメンバーを追加できなかった結果の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(
    "/households?memberChange=add-failed&household=vrt-household&user=vrt-inviter",
  );
  await expect(page.getByRole("alert")).toContainText(
    "メンバーに追加できませんでした",
  );
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品の編集ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products/vrt-catalog-1/edit");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "VRTテストフード を編集する",
    }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品を登録した結果の見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products?catalogChange=created&product=vrt-catalog-2");
  await expect(page.getByRole("status")).toHaveText(
    "VRTまぐろパウチ を登録しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品のリクエストを完了にした結果の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(
    "/food-product-requests?completion=completed&request=vrt-request-done",
  );
  await expect(page.getByRole("status")).toContainText(
    "のリクエストを完了にし、VRT招待者 に通知しました。",
  );
  await takeSnapshot(page, testInfo);
});
