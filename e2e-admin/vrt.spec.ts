import type { Page } from "@playwright/test";
import { expect, takeSnapshot, test } from "../e2e/vrt-snapshot";

// 管理画面（packages/admin）のビジュアルリグレッションテスト (reg-suit)。
//
// メインアプリの VRT と同じ固定フィクスチャ (e2e/fixtures/vrt-seed.sql) を使う。ローカルで
// 実行する場合は `pnpm db:migrate:local && pnpm vrt:seed` を先に実行しておくこと
// （CI の vrt-admin ジョブでは自動的に実行される）。ローカルの D1 に e2e などで作った
// データが残っていると、その分も一覧に表示される。
//
// 書き込み（ログアウトさせる・メンバーの追加・削除・共通のごはん商品の登録・リクエストの完了など）はデータを変えてしまうため実行せず、
// 結果の表示は、書き込みのあとに移動する URL のクエリで再現する（packages/admin/src/client/App.tsx）。
// 画面は React の SPA で、データは開いてから API で読み込むため、読み込み中の表示（aria-busy）が
// 消えるのを待ってから撮る

/** `path` を開き、API からの読み込みが終わるまで待つ */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** `heading` はページの見出し（省略すると `title`） */
const PAGES: { title: string; path: string; heading?: string }[] = [
  { title: "概要", path: "/" },
  { title: "ユーザー", path: "/users" },
  // ログイン中の端末（シードのセッション）と、所属する家を表示する
  { title: "ユーザーの詳細", path: "/users/vrt-inviter", heading: "VRT招待者" },
  { title: "家", path: "/households" },
  // メンバー・猫（メモリーへ移した猫を含む）・まだ使われていない招待と、メンバーの追加のフォームを表示する
  {
    title: "家の詳細",
    path: "/households/vrt-household",
    heading: "VRTの家",
  },
  { title: "共通のごはん商品", path: "/food-products" },
  { title: "共通のごはん商品を登録する", path: "/food-products/new" },
  { title: "共通のごはん商品のリクエスト", path: "/food-product-requests" },
  // シードの ChatGPT との接続と、アイコンを設定していないプロバイダー（agent.example.com）との接続を表示する
  { title: "AIとの接続", path: "/ai-connections" },
];

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
        await open(browserPage, page.path);
        await expect(
          browserPage.getByRole("heading", {
            level: 2,
            name: page.heading ?? page.title,
          }),
        ).toBeVisible();
        await takeSnapshot(browserPage, testInfo);
      });
    }
  });
}

test("すべての端末からログアウトさせた結果の見た目", async ({
  page,
}, testInfo) => {
  await open(page, "/users/vrt-inviter?loggedOut=1");
  await expect(page.getByRole("status")).toHaveText(
    "VRT招待者 をすべての端末からログアウトさせました。",
  );
  await takeSnapshot(page, testInfo);
});

test("家にメンバーを追加した結果の見た目", async ({ page }, testInfo) => {
  await open(
    page,
    "/households/vrt-household?memberChange=added&user=vrt-inviter",
  );
  await expect(page.getByRole("status")).toContainText(
    "メンバーに追加しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("家にメンバーを追加できなかった結果の見た目", async ({
  page,
}, testInfo) => {
  await open(
    page,
    "/households/vrt-household?memberChange=add-failed&user=vrt-inviter",
  );
  await expect(page.getByRole("alert")).toContainText(
    "メンバーに追加できませんでした",
  );
  await takeSnapshot(page, testInfo);
});

test("ユーザーの権限を変えた結果の見た目", async ({ page }, testInfo) => {
  await open(page, "/users/vrt-inviter?roleChange=updated");
  await expect(page.getByRole("status")).toHaveText(
    "VRT招待者 の権限を一般にしました。",
  );
  await takeSnapshot(page, testInfo);
});

test("家からメンバーを外した結果の見た目", async ({ page }, testInfo) => {
  await open(
    page,
    "/households/vrt-invite-household?memberChange=removed&user=vrt-user",
  );
  await expect(page.getByRole("status")).toHaveText(
    "VRTユーザー を VRT招待元の家 から外しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品の編集ページの見た目", async ({ page }, testInfo) => {
  await open(page, "/food-products/vrt-catalog-1/edit");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "VRTテストフード を編集する",
    }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品を登録した結果の見た目", async ({ page }, testInfo) => {
  await open(
    page,
    "/food-products?catalogChange=created&product=vrt-catalog-2",
  );
  await expect(page.getByRole("status")).toHaveText(
    "VRTまぐろパウチ を登録しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品を検索した結果の見た目", async ({ page }, testInfo) => {
  await open(
    page,
    `/food-products?manufacturer=${encodeURIComponent("VRTフーズ")}&q=${encodeURIComponent("まぐろ")}`,
  );
  await expect(page.getByText("2 件中 1 件")).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品のリクエストを完了にした結果の見た目", async ({
  page,
}, testInfo) => {
  await open(
    page,
    "/food-product-requests?completion=completed&request=vrt-request-done",
  );
  await expect(page.getByRole("status")).toContainText(
    "のリクエストを完了にし、VRT招待者 に通知しました。",
  );
  await takeSnapshot(page, testInfo);
});

test("共通のごはん商品を削除する前の確認の見た目", async ({
  page,
}, testInfo) => {
  await open(
    page,
    `/food-products?manufacturer=${encodeURIComponent("VRTフーズ")}&q=${encodeURIComponent("まぐろ")}`,
  );
  // 確認ダイアログを開くだけで、削除はしない
  await page.getByRole("button", { name: "VRTまぐろパウチを削除する" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "VRTまぐろパウチ を削除しますか？",
  );
  await takeSnapshot(page, testInfo);
});
