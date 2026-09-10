import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";

// 通院記録（診療明細）・服薬予定（処方箋）に写真を添付し、書類向けの等倍表示モードで閲覧できることを検証する
test("通院記録と服薬予定に書類の写真を添付し、等倍で閲覧できる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  // 通院記録
  await page.getByRole("link", { name: "通院記録" }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  await page.getByLabel("受診理由").fill("定期健診");
  await page.getByLabel("診療明細などの写真").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      createPng(1200, 400, (x) =>
        x % 40 < 20 ? [30, 30, 30, 255] : [255, 255, 255, 255],
      ),
    ),
  });
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/hospital-visits$/);

  const visitThumbnail = page.getByRole("button", {
    name: "診療明細などの写真 1 を表示",
  });
  await expect(visitThumbnail).toBeVisible();
  const visitSrc =
    (await visitThumbnail.locator("img").getAttribute("src")) ?? "";

  // 等倍表示：モーダル内の画像は縮小されず、元の幅（1200px）のまま横スクロールできる
  await visitThumbnail.click();
  const dialog = page.getByRole("dialog");
  const original = dialog.getByRole("img", { name: "診療明細などの写真 1" });
  await expect
    .poll(() => original.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(1200);
  expect(
    await original.evaluate((el: HTMLImageElement) => el.clientWidth),
  ).toBe(1200);
  await dialog.getByRole("button", { name: "閉じる" }).click();

  // 服薬予定
  await page.goto(page.url().replace(/hospital-visits$/, "medications"));
  await page
    .getByRole("link", { name: "服薬予定を登録する", exact: true })
    .click();
  await page.getByLabel("薬名").fill("抗生剤");
  await page.getByLabel("1回量").fill("1錠");
  await page.getByLabel("1日あたりの回数").fill("2");
  await page.getByLabel("服用開始日").fill("2026-09-08");
  await page.getByLabel("処方箋・薬袋の写真").setInputFiles({
    name: "prescription.png",
    mimeType: "image/png",
    buffer: Buffer.from(createPng(600, 800, () => [240, 240, 220, 255])),
  });
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/medications$/);
  const medicationThumbnail = page.getByRole("button", {
    name: "処方箋・薬袋の写真 1 を表示",
  });
  await expect(medicationThumbnail).toBeVisible();
  const medicationSrc =
    (await medicationThumbnail.locator("img").getAttribute("src")) ?? "";

  // タイムラインには通院記録の写真だけ表示される（服薬の投薬実績には添付しない）
  await page.goto(page.url().replace(/medications$/, "timeline"));
  await expect(
    page.getByRole("button", { name: "通院の添付 1 を表示" }),
  ).toBeVisible();

  // 服薬予定・通院記録を削除すると写真も削除される
  await page.goto(page.url().replace(/timeline.*$/, "medications"));
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(
    page.getByText("まだ服薬予定が登録されていません。"),
  ).toBeVisible();
  expect((await page.request.get(medicationSrc)).status()).toBe(404);

  await page.goto(page.url().replace(/medications$/, "hospital-visits"));
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ通院記録がありません。")).toBeVisible();
  expect((await page.request.get(visitSrc)).status()).toBe(404);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
