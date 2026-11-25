import { expect, type Page, test } from "@playwright/test";
import { fillAndKeep, openCatRegistration } from "./helpers";

/** モーダルを開くボタンを押す。ハイドレーション前に押すと反応しないため、開くまで押し直す */
async function openDialog(page: Page, buttonName: string, title: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: buttonName }).click();
    }
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return dialog;
}

// メモにラベルを付け、一覧をラベルで絞り込めること、付いているラベルは削除できず、
// 付いていないラベルだけを削除できることを検証する
test("メモにラベルを付けて絞り込み、使わなくなったラベルを削除できる", async ({
  page,
}) => {
  const suffix = Date.now();
  const catName = `テスト猫-${suffix}`;
  const labelName = `ラベル-${suffix}`;
  const renamedLabel = `変更後-${suffix}`;

  await openCatRegistration(page);
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await page.getByRole("link", { name: "メモ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}のメモ` }),
  ).toBeVisible();
  const listUrl = page.url();

  // まだないラベルは、入力して Enter で付けると、メモの保存と同時に作られる
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page).toHaveURL(/memo-records\/new$/);
  const labelInput = page.getByRole("combobox", { name: "ラベル" });
  // 候補を開いている間は、入力欄と候補のほかが読み上げから隠れるため、includeHidden で探す
  const tagButton = (name: string) =>
    page.getByRole("button", {
      name: `「${name}」を外す`,
      includeHidden: true,
    });
  for (const name of ["付け間違い", labelName]) {
    await fillAndKeep(labelInput, name);
    await labelInput.press("Enter");
    await expect(tagButton(name)).toBeVisible();
    await expect(labelInput).toHaveValue("");
  }
  // 候補を開いたままでも、× で外せる
  await tagButton("付け間違い").click();
  await expect(tagButton("付け間違い")).toHaveCount(0);
  await expect(page).toHaveURL(/memo-records\/new$/);
  await page.getByRole("textbox", { name: "メモ" }).fill("ラベルありのメモ");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole("article").getByText(labelName)).toBeVisible();

  // 家にあるラベルは候補に出る。選ばずにラベルを付けないメモも作り、絞り込めることを確かめる
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page).toHaveURL(/memo-records\/new$/);
  await expect(async () => {
    await labelInput.fill(labelName);
    await expect(
      page.getByRole("option", { name: labelName, exact: true }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await labelInput.fill("");
  await labelInput.press("Escape");
  await fillAndKeep(
    page.getByRole("textbox", { name: "メモ" }),
    "ラベルなしのメモ",
  );
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page
    .getByRole("navigation", { name: "ラベルでの絞り込み" })
    .getByRole("link", { name: labelName })
    .click();
  await expect(page).toHaveURL(/\?label=/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("ラベルありのメモ")).toBeVisible();

  // 同じ名前のラベルは作れず、入力した名前も消えない
  await page.getByRole("link", { name: "ラベルの管理" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "メモのラベル" }),
  ).toBeVisible();
  const duplicateDialog = await openDialog(
    page,
    "ラベルを追加する",
    "ラベルの追加",
  );
  const duplicateName = duplicateDialog.getByRole("textbox", { name: "名前" });
  await fillAndKeep(duplicateName, labelName);
  await duplicateDialog.getByRole("button", { name: "追加する" }).click();
  await expect(
    duplicateDialog.getByText("同じ名前のラベルがあります"),
  ).toBeVisible();
  await expect(duplicateName).toHaveValue(labelName);
  // エラーの後でも、名前を直せば追加できる
  await duplicateName.fill(`${labelName}-2`);
  await duplicateDialog.getByRole("button", { name: "追加する" }).click();
  await expect(duplicateDialog).toBeHidden();
  const unusedDialog = await openDialog(
    page,
    `「${labelName}-2」を削除する`,
    "ラベルの削除",
  );
  await unusedDialog.getByRole("button", { name: "削除する" }).click();
  await expect(unusedDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: `「${labelName}-2」を削除する` }),
  ).toHaveCount(0);

  // メモに付いているラベルは削除できない
  const inUseDialog = await openDialog(
    page,
    `「${labelName}」を削除する`,
    "ラベルの削除",
  );
  await expect(
    inUseDialog.getByText("1件のメモに付いているため削除できません"),
  ).toBeVisible();
  await expect(
    inUseDialog.getByRole("button", { name: "削除する" }),
  ).toHaveCount(0);
  await inUseDialog.getByRole("button", { name: "閉じる" }).click();

  // 名前を変えると、メモに付いているラベルの名前も変わる
  const editDialog = await openDialog(
    page,
    `「${labelName}」を編集する`,
    "ラベルの編集",
  );
  await fillAndKeep(
    editDialog.getByRole("textbox", { name: "名前" }),
    renamedLabel,
  );
  await editDialog.getByRole("button", { name: "更新する" }).click();
  await expect(
    page.getByRole("button", { name: `「${renamedLabel}」を編集する` }),
  ).toBeVisible();

  // メモからラベルを外す
  await page.goto(listUrl);
  await page
    .getByRole("article")
    .filter({ hasText: "ラベルありのメモ" })
    .getByRole("link", { name: "編集する" })
    .click();
  const removeButton = page.getByRole("button", {
    name: `「${renamedLabel}」を外す`,
  });
  await expect(removeButton).toBeVisible();
  await expect(async () => {
    if (await removeButton.isVisible()) {
      await removeButton.click();
    }
    await expect(removeButton).toBeHidden({ timeout: 1_000 });
  }).toPass();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText(renamedLabel)).toHaveCount(0);

  // どのメモにも付いていないラベルは削除できる
  await page.getByRole("link", { name: "ラベルの管理" }).click();
  const deleteDialog = await openDialog(
    page,
    `「${renamedLabel}」を削除する`,
    "ラベルの削除",
  );
  await deleteDialog.getByRole("button", { name: "削除する" }).click();
  await expect(
    page.getByRole("button", { name: `「${renamedLabel}」を編集する` }),
  ).toHaveCount(0);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});

// 変換の操作を Chromium の DevTools Protocol で再現し、変換を確定する Enter ではラベルを付けず、
// 確定した後の Enter で付けることを検証する
test("日本語の変換中の操作ではラベルを付け外ししない", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;
  await openCatRegistration(page);
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  await page.getByRole("link", { name: "メモ", exact: true }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page).toHaveURL(/memo-records\/new$/);

  const cdp = await page.context().newCDPSession(page);
  const compose = (text: string) =>
    cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  // 変換中のキー入力は、どのキーでも keyCode が 229 になる
  const pressWhileComposing = async (key: string) => {
    const event = { key, code: key, windowsVirtualKeyCode: 229 };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...event });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
  };
  const labelInput = page.getByRole("combobox", { name: "ラベル" });
  const tags = page.getByRole("button", {
    name: /を外す$/,
    includeHidden: true,
  });

  // ハイドレーション前は入力しても反応しないため、タグが付くまでやり直す
  await expect(async () => {
    if ((await tags.count()) === 0) {
      await labelInput.fill("お手入れ");
      await labelInput.press("Enter");
    }
    await expect(tags).toHaveCount(1, { timeout: 1_000 });
  }).toPass();

  await labelInput.focus();
  await compose("びょういん");
  await compose("病院");
  for (const key of ["ArrowDown", "Backspace", "Enter"]) {
    await pressWhileComposing(key);
  }
  await expect(labelInput).toHaveValue("病院");
  await expect(tags).toHaveCount(1);
  await cdp.send("Input.insertText", { text: "病院" });
  await expect(labelInput).toHaveValue("病院");
  await expect(tags).toHaveCount(1);

  await labelInput.press("Enter");
  await expect(labelInput).toHaveValue("");
  await expect(tags).toHaveCount(2);
  await expect(page).toHaveURL(/memo-records\/new$/);

  await page.goto("/cats");
  await page.getByRole("heading", { name: catName }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
