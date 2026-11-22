import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import {
  csvText,
  readZip,
} from "../src/features/record-exports/testing/readZip";

// 家の設定の「記録の出力」で、記録を選んで出力し、完了した zip をダウンロード・削除できることを検証する。
// e2e の dev サーバー（next dev）では Workflow を使えないため、出力はリクエストの後に同じ処理で行われる
// （`src/features/record-exports/presentation/actions.ts`）

async function openRecordExports(page: Page) {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await page.getByRole("link", { name: /記録の出力/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "記録の出力" }),
  ).toBeVisible();
}

test("記録を選んで出力し、zip をダウンロード・削除できる", async ({ page }) => {
  await openRecordExports(page);

  const form = page.getByRole("region", { name: "出力する" });
  // ほかのテストの出力が処理中なら、終わるのを待つ
  await expect(form.getByRole("button", { name: "出力する" })).toBeEnabled({
    timeout: 60_000,
  });
  await form.getByRole("button", { name: "すべて外す" }).click();
  await expect(form.getByRole("button", { name: "出力する" })).toBeDisabled();
  await form
    .getByRole("checkbox", { name: "メモ", exact: true })
    .check({ force: true });
  await form
    .getByRole("checkbox", { name: "体重記録", exact: true })
    .check({ force: true });
  await form.getByRole("button", { name: "出力する" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "出力を始めました。完了すると、下の一覧からダウンロードできます。",
  );

  // 処理中の間はページが 1 秒ごとに状態を確かめ、完了したら一覧を表示し直す
  const item = page
    .getByRole("region", { name: "出力したファイル" })
    .getByRole("article")
    .first();
  await expect(item).toContainText("体重記録・メモ");
  const download = item.getByRole("link", { name: "ダウンロード" });
  await expect(download).toBeVisible({ timeout: 60_000 });
  await expect(item).toContainText("完了");
  await expect(form.getByRole("button", { name: "出力する" })).toBeEnabled();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    download.click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/^canshi-records-\d{8}-\d{4}\.zip$/);
  const entries = readZip(new Uint8Array(await readFile(await file.path())));
  expect(entries.map(({ name }) => name)).toEqual([
    "weight_records.csv",
    "memo_records.csv",
  ]);
  expect(csvText(entries[1]).split("\r\n")[0]).toBe("ID,ねこ,日時,メモ");

  const label = await item.getAttribute("aria-label");
  await item.getByRole("button", { name: /を削除する$/ }).click();
  const dialog = page.getByRole("dialog", { name: "出力の削除" });
  await dialog.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("出力を削除しました")).toBeVisible();
  await expect(page.getByRole("article", { name: label ?? "" })).toHaveCount(0);
});
