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

  // メモのフォームから作ったラベルは、選んだ状態になる
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page).toHaveURL(/memo-records\/new$/);
  const addDialog = await openDialog(page, "新しいラベル", "ラベルの追加");
  await fillAndKeep(
    addDialog.getByRole("textbox", { name: "名前" }),
    labelName,
  );
  await addDialog.getByText("緑", { exact: true }).click();
  await addDialog.getByRole("button", { name: "追加する" }).click();
  await expect(addDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: labelName, pressed: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "メモ" }).fill("ラベルありのメモ");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole("article").getByText(labelName)).toBeVisible();

  // ラベルを付けないメモも作り、絞り込めることを確かめる
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page).toHaveURL(/memo-records\/new$/);
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
  await duplicateDialog.getByRole("button", { name: "キャンセル" }).click();

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
  const selectedLabel = page.getByRole("button", {
    name: renamedLabel,
    pressed: true,
  });
  await expect(selectedLabel).toBeVisible();
  await expect(async () => {
    if (await selectedLabel.isVisible()) {
      await selectedLabel.click();
    }
    await expect(selectedLabel).toBeHidden({ timeout: 1_000 });
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
