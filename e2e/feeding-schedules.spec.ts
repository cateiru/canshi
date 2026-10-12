import { expect, test } from "@playwright/test";

// 家の設定の「ごはんの時間」で、時間の追加・通知の設定の変更・削除ができることを検証する。
// 通知の生成（時間になったときの通知・記録がないときのリマインダー）は時刻に依存するため、
// `src/features/notifications/rules/feedingSchedule.test.ts`・`generate.test.ts` で確かめる
test("ごはんの時間を追加・変更・削除できる", async ({ page }) => {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await page.getByRole("link", { name: /ごはんの時間/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "ごはんの時間" }),
  ).toBeVisible();

  // 他のテストや前回の実行の残りと重ならない、普段使わない時刻を使う
  const time = "03:45";
  const addSection = page.getByRole("region", { name: "ごはんの時間を追加" });
  await addSection.getByRole("button", { name: /時刻/ }).click();
  await page.getByRole("option", { name: time, exact: true }).click();
  await addSection
    .getByRole("checkbox", { name: "時間になったら通知する" })
    .uncheck({ force: true });
  await addSection.getByRole("button", { name: "追加する" }).click();
  await expect(addSection.getByRole("status")).toHaveText(
    `${time}を追加しました`,
  );

  const listSection = page.getByRole("region", {
    name: "登録したごはんの時間",
  });
  const item = listSection.getByRole("listitem").filter({ hasText: time });
  await expect(item).toBeVisible();
  await expect(
    item.getByRole("checkbox", { name: "時間になったら通知する" }),
  ).not.toBeChecked();
  await expect(
    item.getByRole("checkbox", { name: "記録がないときに確認の通知をする" }),
  ).toBeChecked();

  // 同じ時刻は追加できない
  await addSection.getByRole("button", { name: /時刻/ }).click();
  await page.getByRole("option", { name: time, exact: true }).click();
  await addSection.getByRole("button", { name: "追加する" }).click();
  await expect(addSection.getByRole("alert")).toHaveText(
    `${time}はすでに追加されています`,
  );

  await item
    .getByRole("checkbox", { name: "時間になったら通知する" })
    .check({ force: true });
  await item.getByRole("button", { name: "保存する" }).click();
  await expect(item.getByRole("status")).toHaveText("保存しました");
  await page.reload();
  await expect(
    item.getByRole("checkbox", { name: "時間になったら通知する" }),
  ).toBeChecked();

  await item.getByRole("button", { name: "削除する" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await expect(item).toHaveCount(0);
});
