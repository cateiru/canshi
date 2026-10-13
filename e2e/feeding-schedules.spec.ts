import { expect, type Page, test } from "@playwright/test";

// 家の設定の「ごはんの時間」で、時間の追加・通知の設定の変更・削除ができることを検証する。
// 通知の生成（時間になったときの通知・記録がないときのリマインダー）は時刻に依存するため、
// `src/features/notifications/rules/feedingSchedule.test.ts`・`generate.test.ts` で確かめる

// 他のテストや VRT のシードと重ならない、普段使わない時刻を使う
const TIME = "03:45";

async function openFeedingSchedules(page: Page) {
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
}

function scheduleItem(page: Page) {
  return page
    .getByRole("region", { name: "登録したごはんの時間" })
    .getByRole("listitem")
    .filter({ hasText: TIME });
}

async function selectTime(page: Page) {
  const addSection = page.getByRole("region", { name: "ごはんの時間を追加" });
  await addSection.getByRole("button", { name: /時刻/ }).click();
  await page.getByRole("option", { name: TIME, exact: true }).click();
  return addSection;
}

test("ごはんの時間を追加・変更・削除できる", async ({ page }) => {
  await openFeedingSchedules(page);
  const item = scheduleItem(page);

  try {
    const addSection = await selectTime(page);
    await addSection
      .getByRole("checkbox", { name: "時間になったら通知する" })
      .uncheck({ force: true });
    await addSection.getByRole("button", { name: "追加する" }).click();
    await expect(addSection.getByRole("status")).toHaveText(
      `${TIME}を追加しました`,
    );

    await expect(item).toBeVisible();
    await expect(
      item.getByRole("checkbox", { name: "時間になったら通知する" }),
    ).not.toBeChecked();
    await expect(
      item.getByRole("checkbox", { name: "記録がないときに確認の通知をする" }),
    ).toBeChecked();

    // 同じ時刻は追加できない
    await selectTime(page);
    await addSection.getByRole("button", { name: "追加する" }).click();
    await expect(addSection.getByRole("alert")).toHaveText(
      `${TIME}はすでに追加されています`,
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

    await item
      .getByRole("button", { name: `${TIME}のごはんの時間を削除する` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "削除する" })
      .click();
    await expect(item).toHaveCount(0);
  } finally {
    // 途中で失敗しても、次回の実行や同じローカル DB を使う他のテストに残さない
    await openFeedingSchedules(page);
    if ((await item.count()) > 0) {
      await item
        .getByRole("button", { name: `${TIME}のごはんの時間を削除する` })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "削除する" })
        .click();
      await expect(item).toHaveCount(0);
    }
  }
});
