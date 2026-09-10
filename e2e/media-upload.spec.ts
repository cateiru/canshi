import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";

// うんち記録に画像を添付し、一覧とタイムラインにサムネイルが表示され、モーダルで元画像を閲覧できるまでを検証する
test("うんち記録に画像を添付すると一覧・タイムラインにサムネイルが表示される", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "うんち記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("発生日").fill("2026-09-08");
  await page.getByLabel("発生時刻").fill("09:30");
  await page.getByLabel("写真").setInputFiles([
    {
      name: "poop-1.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        createPng(800, 600, (x) =>
          x < 400 ? [255, 0, 0, 255] : [0, 0, 255, 255],
        ),
      ),
    },
    {
      name: "poop-2.png",
      mimeType: "image/png",
      buffer: Buffer.from(createPng(300, 900, () => [0, 200, 0, 255])),
    },
  ]);
  // 選択したファイルのプレビューがフォームに表示される
  await expect(page.getByRole("img", { name: "poop-1.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "poop-2.png" })).toBeVisible();

  await page.getByRole("button", { name: "記録する" }).click();

  // 保存とアップロードが終わると一覧に遷移し、サムネイルが 2 枚表示される
  await expect(page).toHaveURL(/poop-records$/);
  const thumbnails = page.getByRole("button", {
    name: /うんちの写真 \d を表示/,
  });
  await expect(thumbnails).toHaveCount(2);
  await expect
    .poll(() =>
      thumbnails
        .first()
        .locator("img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(512);

  // タップで元画像をモーダル表示できる
  await thumbnails.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const original = dialog.getByRole("img", { name: "うんちの写真 1" });
  await expect
    .poll(() => original.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(800);
  await dialog.getByRole("button", { name: "次へ" }).click();
  await expect(
    dialog.getByRole("img", { name: "うんちの写真 2" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toHaveCount(0);

  // タイムラインにもサムネイルが表示される
  await page.goto(`${page.url().replace(/poop-records$/, "timeline")}`);
  await expect(
    page.getByRole("button", { name: /うんちの添付 \d を表示/ }),
  ).toHaveCount(2);

  // 編集画面で 1 枚削除すると一覧のサムネイルが 1 枚になる
  await page.goto(page.url().replace(/timeline.*$/, "poop-records"));
  await page.getByRole("link", { name: "編集する" }).first().click();
  await page.getByRole("button", { name: "添付 1 を削除" }).click();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/poop-records$/);
  await expect(
    page.getByRole("button", { name: /うんちの写真 \d を表示/ }),
  ).toHaveCount(1);

  // 記録を削除すると写真の配信も止まる
  const remainingSrc =
    (await page
      .getByRole("button", { name: /うんちの写真 \d を表示/ })
      .locator("img")
      .getAttribute("src")) ?? "";
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだうんち記録がありません。")).toBeVisible();
  expect((await page.request.get(remainingSrc)).status()).toBe(404);

  // 後片付け（猫の削除）
  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});

test("猫を削除すると添付した写真も削除される", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "嘔吐記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  await page.getByLabel("写真").setInputFiles({
    name: "vomit.png",
    mimeType: "image/png",
    buffer: Buffer.from(createPng(200, 200, () => [120, 80, 40, 255])),
  });
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/vomit-records$/);
  const thumbnail = page.getByRole("button", { name: "嘔吐の写真 1 を表示" });
  await expect(thumbnail).toBeVisible();
  const src = (await thumbnail.locator("img").getAttribute("src")) ?? "";
  expect((await page.request.get(src)).status()).toBe(200);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
  expect((await page.request.get(src)).status()).toBe(404);
});
