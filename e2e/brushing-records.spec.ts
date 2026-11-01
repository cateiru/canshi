import { expect, test } from "@playwright/test";
import { openCatRegistration } from "./helpers";

// ブラッシング記録の登録・編集・削除ができ、記録が残っていても猫を削除できることを検証する
test("ブラッシング記録の登録・編集・削除ができる", async ({ page }) => {
  const catName = `テスト猫-${Date.now()}`;
  // 経過日数の表示（0日経過）を確定させるため、実施日は JST の「今日」を使う
  // （`shampoo-records.spec.ts` と同じ理由）
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await openCatRegistration(page);
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.getByRole("link", { name: "ブラッシング記録" }).click();
  await expect(
    page.getByRole("heading", { name: `${catName}のブラッシング記録` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await page.getByLabel("実施日").fill(today);
  await page.getByLabel("実施時刻").fill("21:00");
  await page.getByLabel("時間（分）").fill("10");
  await page.getByLabel("抜け毛の量").click();
  await page.getByRole("option", { name: "多い" }).click();
  await page.getByText("毛玉・もつれがあった").click();
  await page.getByLabel("備考").fill("お腹の毛玉をほぐした");
  await page.getByRole("button", { name: "記録する" }).click();

  await expect(page).toHaveURL(/brushing-records$/);
  const record = page.getByRole("article");
  await expect(record.getByText("10分")).toBeVisible();
  await expect(record.getByText("多い")).toBeVisible();
  await expect(record.getByText("毛玉・もつれ")).toBeVisible();
  await expect(record.getByText("お腹の毛玉をほぐした")).toBeVisible();
  await expect(page.getByText("前回のブラッシングから0日経過")).toBeVisible();

  await page.getByRole("link", { name: "編集する" }).click();
  await expect(page.getByLabel("時間（分）")).toHaveValue("10");
  await page.getByLabel("時間（分）").fill("15");
  await page
    .getByText("皮膚の異常（赤み・フケ・かさぶたなど）があった")
    .click();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/brushing-records$/);
  await expect(record.getByText("15分")).toBeVisible();
  await expect(record.getByText("皮膚の異常")).toBeVisible();

  await page.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(
    page.getByText("まだブラッシング記録がありません。"),
  ).toBeVisible();

  // 記録が残っていても猫を削除できる
  await page.getByRole("link", { name: "記録する" }).first().click();
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/brushing-records$/);
  await expect(page.getByRole("article")).toHaveCount(1);

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
