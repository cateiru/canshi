import { expect, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";

function png(color: [number, number, number, number]) {
  return Buffer.from(createPng(320, 240, () => color));
}

test("猫の登録・一覧表示・詳細表示・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();

  await page.getByLabel("名前").fill(catName);
  await page.getByLabel("性別").click();
  await page.getByRole("option", { name: "メス" }).click();
  await page.getByLabel("生年月日", { exact: true }).fill("2020-04-01");
  // ひらがなで途中まで入力すると、カタカナの猫種が候補に出る
  await page.getByRole("combobox", { name: "猫種" }).fill("まんち");
  await page.getByRole("option", { name: "マンチカン", exact: true }).click();
  await page.getByLabel("お迎え日").fill("2020-06-01");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await expect(page.getByText("メス")).toBeVisible();
  await expect(page.getByText("マンチカン")).toBeVisible();
  await expect(page.getByText(/歳/)).toBeVisible();
  await expect(page.getByText(/（お迎えから\d+年(?:\d+ヶ月)?）/)).toBeVisible();

  await page.goto("/cats");
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByRole("combobox", { name: "猫種" })).toHaveValue(
    "マンチカン",
  );
  // 候補にない猫種も入力できる
  await page.getByRole("combobox", { name: "猫種" }).fill("三毛猫");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page.getByText("三毛猫")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  // 猫の名前を正確に入力するまで削除ボタンは押せない
  const dialog = page.getByRole("dialog");
  const confirmButton = dialog.getByRole("button", { name: "削除する" });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByRole("textbox").fill(`${catName}x`);
  await expect(confirmButton).toBeDisabled();
  await dialog.getByRole("textbox").fill(catName);
  await confirmButton.click();

  await expect(page).toHaveURL(/\/cats$/);
  await expect(page.getByRole("heading", { name: catName })).toHaveCount(0);
});

test("猫の編集ページでプロフィール画像を切り抜いて設定・変更・削除できる", async ({
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

  const chooseImage = async (
    name: string,
    color: [number, number, number, number],
  ) => {
    await page.getByLabel("プロフィール画像のファイル").setInputFiles({
      name,
      mimeType: "image/png",
      buffer: png(color),
    });
    const dialog = page.getByRole("dialog", {
      name: "プロフィール画像の範囲を選ぶ",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "この範囲で決定する" }).click();
    await expect(dialog).toHaveCount(0);
  };

  // 画像を選んで切り抜くと、保存前にプレビューされ、保存すると詳細ページに反映される
  await page.goto(`${detailUrl}/edit`);
  await chooseImage("a.png", [255, 0, 0, 255]);
  await expect(avatar()).toBeVisible();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(detailUrl);
  const srcA = await avatarSrc();
  expect(srcA).toMatch(/^\/media\/[^/]+\/thumbnail$/);
  // 切り抜いた正方形の画像が保存される
  const thumbnail = await page.request.get(srcA);
  expect(thumbnail.ok()).toBe(true);

  // 別の画像に差し替えると、古い画像は配信されなくなる
  await page.goto(`${detailUrl}/edit`);
  await chooseImage("b.png", [0, 255, 0, 255]);
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(detailUrl);
  // 保存後は直前の履歴エントリ（詳細ページ）へ戻り、表示は戻った後に最新の内容へ更新される
  await expect(avatar()).not.toHaveAttribute("src", srcA);
  const srcB = await avatarSrc();
  expect(srcB).toMatch(/^\/media\/[^/]+\/thumbnail$/);
  expect(srcB).not.toBe(srcA);
  expect((await page.request.get(srcA)).status()).toBe(404);

  // 画像を選んでもキャンセルすれば保存されない
  await page.goto(`${detailUrl}/edit`);
  await chooseImage("c.png", [0, 0, 255, 255]);
  await page.getByRole("link", { name: "キャンセル" }).click();
  await expect(page).toHaveURL(detailUrl);
  expect(await avatarSrc()).toBe(srcB);

  // 画像を外すとアイコン表示に戻り、画像も削除される
  await page.goto(`${detailUrl}/edit`);
  await page.getByRole("button", { name: "画像を外す" }).click();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(
    page.getByRole("img", { name: `${catName}の画像なし` }),
  ).toBeVisible();
  expect((await page.request.get(srcB)).status()).toBe(404);
});

test("生年月日を年のみ・年月のみでも登録・編集できる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;
  const birthDateDetail = () =>
    page.getByRole("term").filter({ hasText: "生年月日" }).locator("+ dd");
  const choosePrecision = async (label: string) => {
    await page.getByLabel("生年月日のわかる範囲").click();
    await page.getByRole("option", { name: label, exact: true }).click();
  };

  // 年のみで登録すると、補完した月・日は表示されない
  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await choosePrecision("年のみ");
  await page.getByLabel("生まれた年（西暦）").fill("2020");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await expect(birthDateDetail()).toHaveText(/^2020年（\d+歳/);
  const detailUrl = page.url();

  // 編集ページでは年のみの入力が復元され、そのまま保存しても年のみのまま
  await page.goto(`${detailUrl}/edit`);
  await expect(page.getByLabel("生年月日のわかる範囲")).toContainText("年のみ");
  await expect(page.getByLabel("生まれた年（西暦）")).toHaveValue("2020");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(birthDateDetail()).toHaveText(/^2020年（\d+歳/);

  // 年月のみに変えると、月が未選択の場合は保存できない。
  // 入力エラーで戻っても、変更した生まれた年は保存済みの値に戻らない
  await page.goto(`${detailUrl}/edit`);
  await choosePrecision("年月のみ");
  await page.getByLabel("生まれた年（西暦）").fill("2018");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByText("生まれた月を選択してください")).toBeVisible();
  await expect(page.getByLabel("生まれた年（西暦）")).toHaveValue("2018");

  await page.getByLabel("生まれた月").click();
  await page.getByRole("option", { name: "4月", exact: true }).click();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(birthDateDetail()).toHaveText(/^2018年4月（\d+歳/);

  await page.goto(`${detailUrl}/edit`);
  await expect(page.getByLabel("生まれた年（西暦）")).toHaveValue("2018");
  await expect(page.getByLabel("生まれた月")).toContainText("4月");
});
