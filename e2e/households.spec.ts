import { expect, type Page, test } from "@playwright/test";

// 家の設定（名前の変更・招待 URL）と、猫一覧の家ごとのまとまりの開閉を検証する。
// メンバーを外す・オーナーを移譲する・招待 URL で別のユーザーが参加する操作は、
// ログインできるユーザーが 1 人だけで再現できないため、
// `src/features/households/management.test.ts`・`invitations.test.ts` などで確かめる。
// 名前を変えるテストと、家の名前で開閉ボタンを探すテストが重ならないよう、直列に実行する
test.describe.configure({ mode: "serial" });

test("家の名前を変えると、家の設定と猫一覧に反映される", async ({ page }) => {
  await page.goto("/settings/households");
  await expect(
    page.getByRole("heading", { name: "家の設定", exact: true }),
  ).toBeVisible();

  const householdLink = page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" });
  await householdLink.first().click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  await expect(page.getByText("（あなた）")).toBeVisible();

  const nameField = page.getByRole("textbox", { name: "家の名前" });
  const originalName = await nameField.inputValue();
  const newName = `テストの家-${Date.now()}`;

  try {
    await nameField.fill(newName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("家の名前を保存しました");
    await expect(
      page.getByRole("heading", { level: 1, name: newName }),
    ).toBeVisible();

    await page.goto("/cats");
    await expect(page.getByRole("button", { name: newName })).toBeVisible();
  } finally {
    // 同じローカル DB を使う他のテストに影響しないよう、元の名前に戻す
    await page.goto("/settings/households");
    await page.getByRole("link").filter({ hasText: newName }).click();
    await page.getByRole("textbox", { name: "家の名前" }).fill(originalName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("家の名前を保存しました");
  }
});

test("家の名前を空にすると保存できない", async ({ page }) => {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();

  await page.getByRole("textbox", { name: "家の名前" }).fill(" ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("家の名前を入力してください")).toBeVisible();
});

test("猫一覧の家のまとまりを折りたたむと、開き直すまで折りたたんだままになる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;

  // 猫の登録先は、家の設定の一覧で先頭に表示される家（最初に所属した家）
  await page.goto("/settings/households");
  const householdName = await page
    .getByRole("navigation", { name: "パンくずリスト" })
    .locator("xpath=following::h2[1]")
    .innerText();

  // 一覧に家のまとまりが表示されるよう、猫を 1 匹登録しておく
  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();

  await page.goto("/cats");
  const catHeading = page.getByRole("heading", { name: catName });
  // 開閉ボタンの名前には、家の名前に続けて猫の頭数が入る
  const trigger = page.getByRole("button", {
    name: new RegExp(
      `^${householdName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\d+匹$`,
    ),
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(catHeading).toBeVisible();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(catHeading).toBeHidden();

  // 開閉状態は localStorage に保存され、ページを開き直しても折りたたんだまま
  await page.reload();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(catHeading).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(catHeading).toBeVisible();

  // 後片付け: 登録した猫を削除する
  await catHeading.click();
  await page.getByRole("button", { name: "削除する" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(catName);
  await dialog.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/cats$/);
});

/** オーナーとして家の設定を開き、招待 URL を発行してその URL を返す */
async function issueInvitationUrl(page: Page) {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);

  await page.getByRole("button", { name: "招待 URL を発行する" }).click();
  const dialog = page.getByRole("dialog", { name: "招待 URL" });
  const urlField = dialog.getByRole("textbox", { name: "招待 URL" });
  await expect(urlField).toHaveValue(/\/invitations\/[A-Za-z0-9_-]+$/);
  const url = await urlField.inputValue();
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toBeHidden();
  // 閉じたあとの一覧の取り直しを待たずに数えたり押したりしないよう、読み込み直しておく
  await page.reload();
  return url;
}

test("招待 URL を発行し、無効化すると使えなくなる", async ({ page }) => {
  const url = await issueInvitationUrl(page);
  const householdPage = page.url();
  const invitations = page.getByRole("list", {
    name: "まだ使われていない招待",
  });
  await expect(
    invitations.getByRole("button", { name: "無効化する" }).first(),
  ).toBeVisible();
  const countBefore = await invitations.getByRole("listitem").count();

  // オーナー自身が開いても参加済みとして案内され、招待は使用済みにならない
  await page.goto(url);
  await expect(
    page.getByText(/あなたはすでに「.+」のメンバーです/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "参加する" })).toHaveCount(0);

  await page.goto(householdPage);
  await expect(invitations.getByRole("listitem")).toHaveCount(countBefore);

  // 一覧は新しい順のため、先頭が今発行した招待
  await invitations.getByRole("button", { name: "無効化する" }).first().click();
  const dialog = page.getByRole("dialog", { name: "招待の無効化" });
  await dialog.getByRole("button", { name: "無効化する" }).click();
  await expect(page.getByText("招待を無効化しました")).toBeVisible();
  if (countBefore > 1) {
    await expect(invitations.getByRole("listitem")).toHaveCount(
      countBefore - 1,
    );
  } else {
    await expect(
      page.getByText("まだ使われていない招待はありません。"),
    ).toBeVisible();
  }

  await page.goto(url);
  await expect(page.getByText("この招待 URL は使えません。")).toBeVisible();
});

test("ログインしていない状態で招待 URL を開くと、ログイン後に招待のページへ戻る", async ({
  page,
  browser,
}) => {
  const url = await issueInvitationUrl(page);

  const guestContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    const guestPage = await guestContext.newPage();
    await guestPage.goto(url);
    await expect(guestPage).toHaveURL(/\/login\?callbackUrl=/);
    await guestPage.getByRole("button", { name: "ログイン" }).click();

    await expect(guestPage).toHaveURL(new URL(url).pathname);
    await expect(
      guestPage.getByRole("heading", { name: "家への招待" }),
    ).toBeVisible();
  } finally {
    await guestContext.close();
    // 後片付け: 発行した招待を無効化する
    await page.reload();
    await page
      .getByRole("list", { name: "まだ使われていない招待" })
      .getByRole("button", { name: "無効化する" })
      .first()
      .click();
    await page
      .getByRole("dialog", { name: "招待の無効化" })
      .getByRole("button", { name: "無効化する" })
      .click();
    await expect(page.getByText("招待を無効化しました")).toBeVisible();
  }
});
