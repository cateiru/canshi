import { expect, test } from "@playwright/test";
import { solidPng } from "../src/features/media/testing/createPng";

// 開発確認用ページ（/dev/media）を使って、アップロード → 配信 → 削除の一連の基盤動作を検証する
test("画像をアップロードするとサムネイルが配信され、削除すると取得できなくなる", async ({
  page,
}) => {
  await page.goto("/dev/media");
  await expect(
    page.getByRole("heading", { name: "メディアアップロード確認" }),
  ).toBeVisible();

  const fileName = `sample-${Date.now()}.png`;
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: Buffer.from(solidPng(1024, 768, [255, 0, 0, 255])),
  });

  const card = page.getByRole("heading", { name: fileName }).locator("..");
  await expect(card.locator("pre")).toContainText('"mimeType": "image/png"');
  await expect(card.locator("pre")).toContainText('"width": 1024');

  // サムネイル（長辺 512px の WebP）が配信され、ブラウザでデコードできている
  const thumbnail = card.getByRole("img", { name: fileName });
  await expect(thumbnail).toBeVisible();
  await expect
    .poll(() => thumbnail.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(512);
  const thumbnailUrl = await thumbnail.getAttribute("src");
  expect(thumbnailUrl).toMatch(/^\/media\/[^/]+\/thumbnail$/);

  const original = await page.request.get(
    thumbnailUrl!.replace(/\/thumbnail$/, ""),
  );
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toBe("image/png");

  await card.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByRole("heading", { name: fileName })).toHaveCount(0);

  const afterDelete = await page.request.get(thumbnailUrl!);
  expect(afterDelete.status()).toBe(404);
});

test("非対応の形式はエラーメッセージが表示される", async ({ page }) => {
  await page.goto("/dev/media");

  const fileName = `note-${Date.now()}.txt`;
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  const card = page.getByRole("heading", { name: fileName }).locator("..");
  await expect(card.getByRole("alert")).toContainText("対応していない形式");
});
