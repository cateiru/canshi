import { execFileSync } from "node:child_process";
import { expect as baseExpect, type Locator, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

// dev サーバーでは、はじめて開くページ・呼ぶ API のコンパイルに時間がかかるため、既定（5 秒）より長く待つ
const expect = baseExpect.configure({ timeout: 30_000 });

const TOKEN_NAME = "E2EのAPIトークン";

// 発行したトークンが後続のテスト（VRT など）に残らないよう、途中で失敗したときも消す。
// dev サーバーと書き込みが重なると SQLITE_BUSY で失敗することがあるため、少し待ってやり直す
test.afterEach(async () => {
  await expect(async () => {
    execFileSync(
      "node_modules/.bin/wrangler",
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        ".wrangler/state",
        "--command",
        `DELETE FROM api_access_logs WHERE api_token_id IN (SELECT id FROM api_tokens WHERE name = '${TOKEN_NAME}');
        DELETE FROM api_tokens WHERE name = '${TOKEN_NAME}';`,
      ],
      { stdio: "inherit" },
    );
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });
});

/** ハイドレーションの前に押しても反応しないため、効果が出るまで押し直す */
async function pressUntil(
  button: Locator,
  isDone: () => Promise<boolean>,
): Promise<void> {
  await expect(async () => {
    if (!(await isDone())) {
      await button.click();
    }
    expect(await isDone()).toBe(true);
  }).toPass();
}

test("API トークンを発行して API を呼び、許可する範囲を変え、削除できる", async ({
  page,
  request,
}) => {
  // ページを続けて開くため、コンパイルを待つと既定の制限時間（30 秒）を超えることがある
  test.setTimeout(120_000);
  await page.goto("/settings/external-connections");
  await page
    .getByRole("navigation", { name: "外部接続のメニュー" })
    .getByRole("link", { name: /APIトークン/ })
    .click();
  await page.getByRole("link", { name: "トークンを発行する" }).click();
  await expect(page).toHaveURL("/settings/api-tokens/new");

  // 期限なしを選ぶと警告を出す
  const expiration = page.getByRole("button", { name: /有効期限/ });
  const option = page.getByRole("option", { name: "期限なし" });
  await pressUntil(expiration, () => option.isVisible());
  await option.click();
  await expect(
    page.getByText("期限なしのトークンは、削除するまで使い続けられます"),
  ).toBeVisible();

  await fillAndKeep(page.getByLabel("トークンの名前"), TOKEN_NAME);
  await page.getByRole("button", { name: "トークンを発行する" }).click();
  const dialog = page.getByRole("dialog", { name: "トークンを発行しました" });
  await expect(dialog).toBeVisible();
  const token = await dialog.getByLabel("API トークン").inputValue();
  expect(token).toMatch(/^canshi_/);
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(page).toHaveURL("/settings/api-tokens");

  const card = page.getByRole("region", { name: `トークン「${TOKEN_NAME}」` });
  await expect(card.getByText("期限なし")).toBeVisible();
  await expect(card.getByText("まだ使われていません")).toBeVisible();

  // ログインの Cookie ではなく、トークンで認証する
  expect((await request.get("/api/v1/households")).status()).toBe(401);
  const callApi = () =>
    request.get("/api/v1/households", {
      headers: { Authorization: `Bearer ${token}` },
    });
  const response = await callApi();
  expect(response.status()).toBe(200);
  const { households } = (await response.json()) as {
    households: { id: string; name: string }[];
  };
  expect(households.length).toBeGreaterThan(0);

  // 履歴は応答の後に記録するため、表示されるまで読み込み直す
  await expect(async () => {
    await page.reload();
    await expect(card.getByText("まだ使われていません")).toHaveCount(0);
  }).toPass();

  // 家を外すと、API からは見えなくなる
  await card.getByRole("link", { name: "許可する範囲" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: TOKEN_NAME }),
  ).toBeVisible();
  const checkbox = page.getByRole("checkbox", {
    name: `${households[0].name}の記録を読む`,
    exact: true,
  });
  const label = page.locator("label", { has: checkbox }).first();
  await pressUntil(label, async () => !(await checkbox.first().isChecked()));
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("許可する範囲を保存しました")).toBeVisible();
  const restricted = (await (await callApi()).json()) as {
    households: { id: string }[];
  };
  expect(restricted.households.length).toBe(households.length - 1);

  await page.goto("/settings/api-tokens");
  const deleteDialog = page.getByRole("dialog", {
    name: "トークンを削除しますか？",
  });
  await pressUntil(card.getByRole("button", { name: "削除" }), () =>
    deleteDialog.isVisible(),
  );
  await deleteDialog.getByRole("button", { name: "削除する" }).click();
  await expect(card).toHaveCount(0);
  expect((await callApi()).status()).toBe(401);
});

test("削除したトークンや、存在しないトークンのページは表示しない", async ({
  page,
}) => {
  const response = await page.goto("/settings/api-tokens/missing-token");
  expect(response?.status()).toBe(404);
});
