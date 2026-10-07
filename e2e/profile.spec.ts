import { expect, type Page, test } from "@playwright/test";
import { createPng } from "../src/features/media/testing/createPng";
import { fillAndKeep } from "./helpers";

// プロフィール設定（名前・アイコン）を検証する。ログインユーザーは全テストで共有しているため、
// 名前を変えるテストとアイコンを変えるテストが重ならないよう直列に実行し、最後に元へ戻す
test.describe.configure({ mode: "serial" });

function png(color: [number, number, number, number]) {
  return Buffer.from(createPng(320, 240, () => color));
}

/** ログインユーザーが所属する家（オーナーの家）の詳細設定ページを開く */
async function openOwnHousehold(page: Page) {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
}

test("名前を変えると、家のメンバー一覧に反映される", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(
    page.getByRole("heading", { level: 1, name: "プロフィール設定" }),
  ).toBeVisible();

  const nameField = page.getByRole("textbox", { name: "名前" });
  const originalName = await nameField.inputValue();
  const newName = `テストユーザー-${Date.now()}`;

  try {
    await fillAndKeep(nameField, newName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "プロフィールを保存しました",
    );

    await openOwnHousehold(page);
    await expect(page.getByText(`${newName}（あなた）`)).toBeVisible();
  } finally {
    await page.goto("/settings/profile");
    await fillAndKeep(
      page.getByRole("textbox", { name: "名前" }),
      originalName,
    );
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "プロフィールを保存しました",
    );
  }
});

test("名前を空にすると保存できない", async ({ page }) => {
  await page.goto("/settings/profile");
  await fillAndKeep(page.getByRole("textbox", { name: "名前" }), " ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("名前を入力してください")).toBeVisible();
});

test("アイコンを切り抜いて設定・変更・削除でき、家のメンバー一覧に表示される", async ({
  page,
}) => {
  await page.goto("/settings/profile");
  const name = await page.getByRole("textbox", { name: "名前" }).inputValue();
  const icon = () =>
    page.getByRole("img", { name: `${name}のアイコン`, exact: true });
  const iconSrc = async () => (await icon().getAttribute("src")) ?? "";

  const chooseImage = async (
    fileName: string,
    color: [number, number, number, number],
  ) => {
    await page.getByLabel("アイコン画像のファイル").setInputFiles({
      name: fileName,
      mimeType: "image/png",
      buffer: png(color),
    });
    const dialog = page.getByRole("dialog", {
      name: "アイコン画像の範囲を選ぶ",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "この範囲で決定する" }).click();
    await expect(dialog).toHaveCount(0);
  };

  const save = async () => {
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "プロフィールを保存しました",
    );
    // 保存すると、保存ボタンを押すよう促す案内は消える
    await expect(
      page.getByText("「保存する」を押すと反映されます。"),
    ).toHaveCount(0);
  };

  try {
    // 画像を選んで切り抜くと、保存前にプレビューされ、保存すると家のメンバー一覧にも表示される
    await chooseImage("a.png", [255, 0, 0, 255]);
    await expect(icon()).toBeVisible();
    await save();
    const srcA = await iconSrc();
    expect(srcA).toMatch(/^\/media\/[^/]+\/thumbnail$/);
    expect((await page.request.get(srcA)).ok()).toBe(true);

    await openOwnHousehold(page);
    await expect(icon()).toHaveAttribute("src", srcA);

    // 別の画像に差し替えると、古い画像は配信されなくなる
    await page.goto("/settings/profile");
    await chooseImage("b.png", [0, 255, 0, 255]);
    await save();
    await expect(icon()).not.toHaveAttribute("src", srcA);
    const srcB = await iconSrc();
    expect(srcB).toMatch(/^\/media\/[^/]+\/thumbnail$/);
    expect((await page.request.get(srcA)).status()).toBe(404);

    // 画像を外すと、アイコンなしの表示に戻り、画像は配信されなくなる
    await page.getByRole("button", { name: "画像を外す" }).click();
    await save();
    await expect(
      page.getByRole("img", { name: `${name}のアイコンなし` }),
    ).toBeVisible();
    expect((await page.request.get(srcB)).status()).toBe(404);
  } finally {
    // 同じローカル DB を使う他のテストに影響しないよう、アイコンなしに戻す
    await page.goto("/settings/profile");
    const removeButton = page.getByRole("button", { name: "画像を外す" });
    if (await removeButton.isVisible()) {
      await removeButton.click();
      await page.getByRole("button", { name: "保存する" }).click();
      await expect(page.getByRole("status")).toHaveText(
        "プロフィールを保存しました",
      );
    }
  }
});
