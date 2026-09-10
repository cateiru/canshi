import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";

// 症状記録に動画と写真を添付し、動画はブラウザ側で生成したサムネイルが一覧に表示され、モーダルで再生できることを検証する
test("症状記録に動画と写真を添付できる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "症状記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("症状の種類").fill("くしゃみ");
  await page.getByLabel("写真・動画").setInputFiles([
    {
      name: "sample.webm",
      mimeType: "video/webm",
      buffer: fs.readFileSync(path.join(__dirname, "fixtures/sample.webm")),
    },
    {
      name: "symptom.png",
      mimeType: "image/png",
      buffer: Buffer.from(createPng(400, 300, () => [200, 120, 60, 255])),
    },
  ]);
  await expect(page.getByText("動画は位置情報などのメタデータ")).toBeVisible();
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/symptoms$/);
  const thumbnails = page.getByRole("button", {
    name: /症状の写真・動画 \d を表示/,
  });
  await expect(thumbnails).toHaveCount(2);

  // 1 件目は動画。サムネイルはブラウザで切り出したフレームから生成される（320x240 → 320x240 のまま）
  await expect
    .poll(() =>
      thumbnails
        .first()
        .locator("img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(320);
  await thumbnails.first().click();
  const dialog = page.getByRole("dialog");
  const video = dialog.locator("video");
  await expect(video).toBeVisible();
  const videoSrc = (await video.getAttribute("src")) ?? "";
  const response = await page.request.get(videoSrc);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("video/webm");
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "閉じる" }).click();

  // 記録を削除すると動画・写真の配信も止まる
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ症状記録がありません。")).toBeVisible();
  expect((await page.request.get(videoSrc)).status()).toBe(404);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
