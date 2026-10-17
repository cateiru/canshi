import { expect, type Page, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

// 家の設定（名前の変更・招待 URL）と、猫一覧の家ごとのまとまりの開閉を検証する。
// メンバーを外す・オーナーを移譲する・招待 URL で別のユーザーが参加する操作は、
// 複数のユーザーでのログインを組み合わせる必要があるため、
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

test("家の設定からその家のごはん商品・プリセットの一覧へ移動して戻れる", async ({
  page,
}) => {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  const householdPage = new URL(page.url()).pathname;
  const householdId = householdPage.split("/").at(-1) ?? "";
  const householdName = await page
    .getByRole("heading", { level: 1 })
    .innerText();

  for (const { name, path } of [
    { name: "ごはん商品一覧", path: "/food-products" },
    { name: "ごはんプリセット一覧", path: "/feeding-presets" },
  ]) {
    await page
      .getByRole("navigation", { name: "ごはんの設定" })
      .getByRole("link", { name: new RegExp(name) })
      .click();
    await expect(page).toHaveURL(
      `${path}?householdId=${encodeURIComponent(householdId)}`,
    );
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    // パンくずの家の名前から、家の設定へ戻れる
    await page
      .getByRole("navigation", { name: "パンくずリスト" })
      .getByRole("link", { name: householdName, exact: true })
      .click();
    await expect(page).toHaveURL(householdPage);
  }
});

test("家のごはん商品一覧から登録すると、その家の一覧へ戻る", async ({
  page,
}) => {
  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  const householdId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const householdName = await page
    .getByRole("heading", { level: 1 })
    .innerText();
  const householdListUrl = `/food-products?householdId=${encodeURIComponent(householdId)}`;
  const productName = `家の商品-${Date.now()}`;

  await page.goto(householdListUrl);
  await page
    .getByRole("main")
    .getByRole("link", { name: "商品を登録する" })
    .first()
    .click();
  // 登録方法の選択を経由しても、家の指定を引き継ぐ
  await expect(page).toHaveURL(
    `/food-products/add?householdId=${encodeURIComponent(householdId)}`,
  );
  await page.getByRole("link", { name: /手動で入力する/ }).click();
  await expect(page).toHaveURL(
    `/food-products/new?householdId=${encodeURIComponent(householdId)}`,
  );
  // パンくずは家の設定を経由し、その家の商品一覧へ戻れる
  const breadcrumb = page.getByRole("navigation", { name: "パンくずリスト" });
  await expect(
    breadcrumb.getByRole("link", { name: householdName, exact: true }),
  ).toBeVisible();
  await expect(
    breadcrumb.getByRole("link", { name: "ごはん商品一覧" }),
  ).toHaveAttribute("href", householdListUrl);

  await page.getByLabel("商品名").fill(productName);
  await page.getByLabel("カロリー（kcal/100g）").fill("380");
  await page.getByLabel("内容量（g）").fill("1500");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(householdListUrl);
  await expect(
    page.getByRole("heading", { name: productName, exact: true }),
  ).toBeVisible();
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

test("家の設定から家を作成すると、作成した家のページに移り、オーナーになる", async ({
  page,
}) => {
  // 家は削除できないため、他のテストの家と取り違えないよう一意な名前にする。
  // 家の一覧は所属した順に並ぶため、作成した家は末尾に入り、先頭の家を使う他のテストには影響しない
  const householdName = `作成した家-${Date.now()}`;

  await page.goto("/settings/households");
  await page.getByRole("link", { name: "家を作成する" }).click();
  await expect(page).toHaveURL(/\/settings\/households\/new$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "家を作成する" }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "家の名前" }).fill(householdName);
  await page.getByRole("button", { name: "家を作成する" }).click();

  await expect(page).toHaveURL(/\/settings\/households\/(?!new$)[^/]+$/);
  await expect(
    page.getByRole("heading", { level: 1, name: householdName }),
  ).toBeVisible();
  await expect(page.getByText("（あなた）")).toBeVisible();

  await page.goto("/settings/households");
  await expect(
    page
      .getByRole("link")
      .filter({ hasText: householdName })
      .filter({ hasText: "あなたはオーナー" }),
  ).toBeVisible();
});

test("家の名前を空にすると家を作成できない", async ({ page }) => {
  await page.goto("/settings/households/new");
  await page.getByRole("textbox", { name: "家の名前" }).fill(" ");
  await page.getByRole("button", { name: "家を作成する" }).click();
  await expect(page.getByText("家の名前を入力してください")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/households\/new$/);
});

test("家に所属しているユーザーも、猫一覧の追加メニューから家を作成できる", async ({
  page,
}) => {
  await page.goto("/cats");
  const menuItem = page.getByRole("menuitem", { name: "家を作成する" });
  // ハイドレーション前に押すとメニューが開かないため、開くまで押し直す
  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await page.getByRole("button", { name: "追加する" }).click();
    }
    await expect(menuItem).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(
    page.getByRole("menuitem", { name: "猫を登録する" }),
  ).toBeVisible();
  await menuItem.click();
  await expect(page).toHaveURL(/\/settings\/households\/new\?from=cats$/);

  const householdName = `追加メニューから作成した家-${Date.now()}`;
  await fillAndKeep(
    page.getByRole("textbox", { name: "家の名前" }),
    householdName,
  );
  await page.getByRole("button", { name: "家を作成する" }).click();

  // 作成後は猫一覧へ戻り、作成した家のまとまりが表示される
  await expect(page).toHaveURL(/\/cats$/);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${householdName}\\s*0匹$`),
    }),
  ).toBeVisible();
});

test("家に所属していないユーザーは、猫一覧から家を作成できる", async ({
  browser,
}) => {
  // e2e のユーザーはすでに家に所属しているため、家のない新しいユーザーでログインし直す。
  // e2e は `next dev` に対して実行するため、`/login` は入力したメールアドレスでログインする
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  try {
    await page.goto("/login?callbackUrl=%2Fcats");
    await page
      .getByLabel("メールアドレス（開発用）")
      .fill(`e2e-new-household-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/cats$/);

    await expect(page.getByText("所属している家がありません。")).toBeVisible();
    // 家がないうちは猫を登録できないため、追加メニューを出さない
    await expect(page.getByRole("link", { name: "猫を登録する" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "追加する" })).toHaveCount(0);

    await page.getByRole("link", { name: "家を作成する" }).click();
    await expect(page).toHaveURL(/\/settings\/households\/new\?from=cats$/);

    const householdName = `猫一覧から作成した家-${Date.now()}`;
    await page.getByRole("textbox", { name: "家の名前" }).fill(householdName);
    await page.getByRole("button", { name: "家を作成する" }).click();

    // 作成後は猫一覧へ戻り、作成した家のまとまりが表示される
    await expect(page).toHaveURL(/\/cats$/);
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^${householdName}\\s*0匹$`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "最初の猫を登録する" }),
    ).toBeVisible();
    await expect(page.getByText("所属している家がありません。")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
