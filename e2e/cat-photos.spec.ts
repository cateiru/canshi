import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";
import { fillAndKeep } from "./helpers";

function png(color: [number, number, number, number]) {
  return Buffer.from(createPng(320, 240, () => color));
}

// 写真記録の登録と、プロフィール画像の自動更新・固定・解除・削除時の付け替えを検証する
test("猫の写真を登録するとプロフィール画像が自動更新され、固定と解除ができる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;
  const avatar = () =>
    page.getByRole("img", { name: `${catName}のプロフィール画像` });
  const avatarSrc = async () => (await avatar().getAttribute("src")) ?? "";

  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await expect(
    page.getByRole("img", { name: `${catName}の画像なし` }),
  ).toBeVisible();
  const detailUrl = page.url();

  const addPhoto = async (
    takenDate: string,
    name: string,
    color: [number, number, number, number],
  ) => {
    await page.goto(`${detailUrl}/photos/new`);
    await fillAndKeep(page.getByLabel("撮影日"), takenDate);
    await fillAndKeep(page.getByLabel("撮影時刻"), "12:00");
    await page.getByLabel("写真").setInputFiles({
      name,
      mimeType: "image/png",
      buffer: png(color),
    });
    await page.getByRole("button", { name: "登録する", exact: true }).click();
    await expect(page).toHaveURL(/photos$/);
  };

  // 1 枚目：自動でプロフィール画像になる
  await addPhoto("2026-09-01", "a.png", [255, 0, 0, 255]);
  await expect(page.getByText("プロフィール", { exact: true })).toBeVisible();
  await page.goto(detailUrl);
  const srcA = await avatarSrc();
  expect(srcA).toMatch(/^\/media\/[^/]+\/thumbnail$/);

  // 2 枚目（撮影日時がより新しい）：プロフィール画像が更新される
  await addPhoto("2026-09-05", "b.png", [0, 255, 0, 255]);
  await page.goto(detailUrl);
  const srcB = await avatarSrc();
  expect(srcB).not.toBe(srcA);

  // 古い写真（一覧では 2 件目）をプロフィールに固定する
  await page.goto(`${detailUrl}/photos`);
  await page.getByRole("button", { name: "猫の写真 1 を表示" }).nth(1).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "プロフィール画像にする" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("プロフィール画像（固定中）"),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.goto(detailUrl);
  expect(await avatarSrc()).toBe(srcA);

  // 固定中は新しい写真を追加しても変わらない
  await addPhoto("2026-09-07", "c.png", [0, 0, 255, 255]);
  await expect(page.getByText("プロフィール画像は固定中です")).toBeVisible();
  await page.goto(detailUrl);
  expect(await avatarSrc()).toBe(srcA);

  // 固定を解除すると最新の写真（3 枚目）に戻る
  await page.goto(`${detailUrl}/photos`);
  await page.getByRole("button", { name: "猫の写真 1 を表示" }).nth(2).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "固定を解除して自動更新に戻す" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "プロフィール画像にする" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.goto(detailUrl);
  const srcC = await avatarSrc();
  expect(srcC).not.toBe(srcA);
  expect(srcC).not.toBe(srcB);

  // タイムラインに写真記録が表示される
  await page.goto(`${detailUrl}/timeline`);
  await expect(
    page.getByRole("button", { name: "写真の添付 1 を表示" }),
  ).toHaveCount(3);

  // 最新の写真記録を削除すると、残りの中で最新の写真に付け替わる
  await page.goto(`${detailUrl}/photos`);
  await page.getByRole("button", { name: "削除する" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(
    page.getByRole("button", { name: "猫の写真 1 を表示" }),
  ).toHaveCount(2);
  await page.goto(detailUrl);
  expect(await avatarSrc()).toBe(srcB);
  expect((await page.request.get(srcC)).status()).toBe(404);

  // 猫を削除すると写真もすべて削除される
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
  expect((await page.request.get(srcA)).status()).toBe(404);
  expect((await page.request.get(srcB)).status()).toBe(404);
});
