import { expect, type Page, test } from "@playwright/test";
import { openCatRegistration } from "./helpers";

async function registerMedication(
  page: Page,
  catId: string,
  fields: { name: string; startDate: string; endDate?: string },
) {
  await page.goto(`/cats/${catId}/medications/new`);
  await page.getByLabel("薬名").fill(fields.name);
  await page.getByLabel("1回量").fill("1錠");
  await page.getByLabel("1日あたりの回数").fill("1");
  await page.getByLabel("服用開始日").fill(fields.startDate);
  if (fields.endDate) {
    await page.getByLabel("終了予定日").fill(fields.endDate);
  }
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/medications$/);
}

// 服薬予定を服薬歴に移す・戻す操作と、終了予定日を過ぎたものが服薬歴に入ることを検証する
test("服薬予定を服薬歴に移したり戻したりできる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;

  await openCatRegistration(page);
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  const catId = new URL(page.url()).pathname.split("/")[2];

  await registerMedication(page, catId, {
    name: "抗生剤",
    startDate: "2026-09-01",
  });
  await registerMedication(page, catId, {
    name: "点眼薬",
    startDate: "2024-05-01",
    endDate: "2024-05-14",
  });

  const historyToggle = page.getByRole("button", { name: /^服薬歴 \d+件$/ });
  const current = page.getByRole("article", { name: "抗生剤" });
  const ended = page.getByRole("article", { name: "点眼薬" });

  // 終了予定日を過ぎたものは、折りたたんだ服薬歴に入る
  await expect(current).toBeVisible();
  await expect(historyToggle).toHaveText(/1件/);
  await expect(ended).toBeHidden();
  await historyToggle.click();
  await expect(ended).toBeVisible();
  await expect(
    ended.getByRole("button", { name: "服薬予定に戻す" }),
  ).toHaveCount(0);

  // 手動で服薬歴に移す
  await current.getByRole("button", { name: "服薬歴に移す" }).click();
  await expect(page.getByText("服用中の薬はありません。")).toBeVisible();
  await expect(historyToggle).toHaveText(/2件/);
  await expect(current.getByText("服薬歴に移した日")).toBeVisible();

  // 服薬予定に戻す
  await current.getByRole("button", { name: "服薬予定に戻す" }).click();
  await expect(page.getByText("服用中の薬はありません。")).toBeHidden();
  await expect(historyToggle).toHaveText(/1件/);
  await expect(
    current.getByRole("button", { name: "服薬歴に移す" }),
  ).toBeVisible();

  // 後片付け（猫の削除）
  await page.goto(`/cats/${catId}`);
  await page.getByRole("button", { name: "削除する" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(catName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(page).toHaveURL(/\/cats$/);
});
