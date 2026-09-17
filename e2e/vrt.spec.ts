import { expect, takeSnapshot, test } from "@chromatic-com/playwright";

// ビジュアルリグレッションテスト (Chromatic)。
// 動的データ (日時・特定の猫のデータ等) を含まない静的なページのみを対象にする。
//
// 以下は対象外 (意図的な除外):
// - "/" : 登録済みの猫の数によってリダイレクト先が変わる (top-page.spec.ts 参照)
// - "/cats/[catId]/..." 配下すべて: 猫の年齢表示や記録一覧は猫ごとのデータに依存し、
//   記録の新規登録フォームの多くは日付欄の初期値が `new Date()` (今日) のため、
//   実行日によってスナップショットが変化してしまう
// - "/notifications" : 表示するたびに `generateNotifications` で通知を生成する副作用があり、
//   登録済みの猫のデータにも依存する

test("コンポーネントプレビューページの見た目", async ({ page }, testInfo) => {
  await page.goto("/dev/components");
  await expect(
    page.getByRole("heading", { name: "コンポーネントプレビュー" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("メディアアップロード確認ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/dev/media");
  await expect(
    page.getByRole("heading", { name: "メディアアップロード確認" }),
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

test("ホームページの見た目", async ({ page }, testInfo) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "CANSHI" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("猫一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/cats");
  await expect(page.getByRole("heading", { name: "猫一覧" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("猫登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/cats/new");
  await expect(
    page.getByRole("heading", { name: "猫を登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはん商品一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products");
  await expect(
    page.getByRole("heading", { name: "ごはん商品一覧" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはん商品登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products/new");
  await expect(
    page.getByRole("heading", { name: "ごはん商品を登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはんプリセット一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/feeding-presets");
  await expect(
    page.getByRole("heading", { name: "ごはんプリセット一覧" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはんプリセット登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/feeding-presets/new");
  await expect(
    page.getByRole("heading", { name: "ごはんプリセットを登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("通知設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings/notifications");
  await expect(page.getByRole("heading", { name: "通知設定" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("更新情報ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/release-notes");
  await expect(page.getByRole("heading", { name: "更新情報" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});
