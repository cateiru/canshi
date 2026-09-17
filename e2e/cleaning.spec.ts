import { expect, test } from "@playwright/test";

// 掃除対象(target)の登録・編集・削除と、対象ごとの実施記録(record)の登録・編集・削除を検証する
test("掃除対象と実施記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await page.goto("/cats");
  await page
    .getByRole("link", { name: /猫を登録する/ })
    .first()
    .click();
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  // 掃除対象の登録
  await page.getByRole("link", { name: "掃除記録" }).click();
  await expect(
    page.getByText("まだ掃除対象が登録されていません。"),
  ).toBeVisible();
  await page.getByRole("link", { name: "最初の対象を追加する" }).click();

  await page.getByLabel("名前").fill("トイレ");
  await page.getByLabel("頻度").fill("14");
  await page.getByText("ヶ月").click();
  // プリセットのワンタップ追加ボタン（例:「猫砂を追加する」）にも「追加する」が
  // 部分一致してしまうため、完全一致でフォーム自体の送信ボタンに絞り込む
  await page.getByRole("button", { name: "追加する", exact: true }).click();

  await expect(page).toHaveURL(/\/cleaning$/);
  const targetCard = page.getByRole("article", { name: "トイレ" });
  await expect(targetCard).toBeVisible();
  await expect(targetCard.getByText("未実施")).toBeVisible();

  // 掃除対象の編集
  await targetCard.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("名前")).toHaveValue("トイレ");
  await page.getByLabel("名前").fill("トイレ（更新）");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page).toHaveURL(/\/cleaning$/);
  const updatedTargetCard = page.getByRole("article", {
    name: "トイレ（更新）",
  });
  await expect(updatedTargetCard).toBeVisible();

  // 実施記録の登録
  await updatedTargetCard.getByRole("link", { name: "記録を見る" }).click();
  await expect(page.getByText("まだ実施記録がありません。")).toBeVisible();
  await page.getByRole("link", { name: "最初の記録をする" }).click();

  await page.getByLabel("実施日").fill("2026-09-10");
  await page.getByLabel("実施時刻").fill("09:00");
  await page.getByLabel("備考").fill("しっかり掃除した");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/\/records$/);
  const record = page.getByRole("article");
  await expect(record.getByText("しっかり掃除した")).toBeVisible();

  // 実施記録の編集
  await record.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("備考")).toHaveValue("しっかり掃除した");
  await page.getByLabel("備考").fill("更新済み");
  await page.getByRole("button", { name: "更新する" }).click();

  await expect(page).toHaveURL(/\/records$/);
  await expect(record.getByText("更新済み")).toBeVisible();

  // 実施記録の削除
  await record.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page.getByText("まだ実施記録がありません。")).toBeVisible();

  // 掃除対象の削除（編集画面の危険操作ゾーンから）
  await page.goto(
    page.url().replace(/\/cleaning\/targets\/[^/]+\/records$/, "/cleaning"),
  );
  await page
    .getByRole("article", { name: "トイレ（更新）" })
    .getByRole("link", { name: "編集する" })
    .click();
  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cleaning$/);
  await expect(
    page.getByText("まだ掃除対象が登録されていません。"),
  ).toBeVisible();

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
