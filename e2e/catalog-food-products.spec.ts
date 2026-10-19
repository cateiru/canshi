import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// 共通のごはん商品は管理画面（packages/admin）からしか登録できないため、ローカルの D1 に
// 直接追加する。dev サーバーと書き込みが重なると SQLITE_BUSY で失敗することがあるため、
// 少し待ってやり直す（e2e/auth.setup.ts と同じ）。内容量の候補は `packageSizes`（JSON）で渡し、
// 省略すると候補を追加する前に登録された商品と同じく空にする（14g/本 が唯一の候補になる）
async function insertCatalogFoodProduct(
  id: string,
  name: string,
  packageSizes = "[]",
) {
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
        `INSERT INTO catalog_food_products (id, name, manufacturer, kcal_per_100g, package_amount_g, package_unit, nutrition_type, texture_type, life_stages, package_sizes)
        VALUES ('${id}', '${name}', 'E2Eフーズ', 40, 14, '本', 'general', 'wet', '["senior"]', '${packageSizes}')`,
      ],
      { stdio: "inherit" },
    );
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });
}

test("共通のごはん商品を検索して家に追加し、追加した商品を編集できる", async ({
  page,
}) => {
  const suffix = Date.now();
  const productName = `共通のちゅーる-${suffix}`;
  await insertCatalogFoodProduct(
    `e2e-catalog-${suffix}`,
    productName,
    '[{"amountG":14,"unit":"本"},{"amountG":70,"unit":null}]',
  );

  await page.goto("/food-products");
  await page
    .getByRole("main")
    .getByRole("link", { name: "商品を登録する" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/food-products\/add/);
  await page.getByRole("link", { name: /共通のごはん商品から探す/ }).click();
  await expect(page).toHaveURL(/\/food-products\/search/);

  // 詳しい条件（メーカー名）も合わせて検索する
  await page.getByLabel("商品名・メーカー名").fill(`ちゅーる-${suffix}`);
  await page.getByRole("button", { name: "詳しい条件で絞り込む" }).click();
  await page.getByLabel("メーカー名", { exact: true }).fill("E2Eフーズ");
  await page.getByRole("button", { name: "検索する" }).click();
  await expect(page).toHaveURL(/manufacturer=/);

  const candidate = page.getByRole("article", { name: productName });
  await expect(candidate).toBeVisible();
  await expect(candidate).toContainText("一般食 ・ ウェット ・ 40kcal/100g");
  await expect(candidate).toContainText("対象：シニア");
  // 内容量の候補から、追加する内容量を選ぶ
  await expect(candidate).toContainText("14g/本 / 70g");
  await candidate.getByRole("button", { name: /内容量/ }).click();
  await page.getByRole("option", { name: "70g" }).click();
  await candidate
    .getByRole("button", { name: `${productName}を追加する` })
    .click();

  // 家のごはん商品一覧に、内容を写した商品が追加される
  await expect(page).toHaveURL(/\/food-products$/);
  const added = page.getByRole("article", { name: productName });
  await expect(added).toBeVisible();
  await expect(added).toContainText("E2Eフーズ");
  await expect(added.locator("dd").filter({ hasText: "70" })).toHaveText("70g");

  // 同じ家ではもう一度追加しないよう「追加済み」と表示する
  await page.goto(
    `/food-products/search?q=${encodeURIComponent(`ちゅーる-${suffix}`)}`,
  );
  await expect(
    page.getByRole("article", { name: productName }).getByText("追加済み"),
  ).toBeVisible();

  // 追加した商品は、手動で登録した商品と同じく自由に編集できる
  await page.goto("/food-products");
  await page
    .getByRole("article", { name: productName })
    .getByRole("link", { name: "編集する" })
    .click();
  const editedName = `${productName}（編集済み）`;
  await page.getByLabel("商品名").fill(editedName);
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page).toHaveURL(/\/food-products$/);
  await expect(
    page.getByRole("heading", { name: editedName, exact: true }),
  ).toBeVisible();
});

test("登録方法の選択・検索のページは履歴に残らず、登録した後に戻ると登録を始めた画面に戻る", async ({
  page,
}) => {
  const suffix = Date.now();
  const productName = `履歴の確認-${suffix}`;
  const switchedProductName = `選び直しの確認-${suffix}`;
  await insertCatalogFoodProduct(`e2e-catalog-history-${suffix}`, productName);
  await insertCatalogFoodProduct(
    `e2e-catalog-switch-${suffix}`,
    switchedProductName,
  );

  await page.goto("/settings/households");
  await page
    .getByRole("link")
    .filter({ hasText: "あなたはオーナー" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  const householdPage = new URL(page.url()).pathname;
  const householdId = householdPage.split("/").at(-1) ?? "";
  const listUrl = `/food-products?householdId=${encodeURIComponent(householdId)}`;

  const openRegistration = async (option: RegExp) => {
    await page
      .getByRole("navigation", { name: "ごはんの設定" })
      .getByRole("link", { name: /ごはん商品一覧/ })
      .click();
    await expect(page).toHaveURL(listUrl);
    await page
      .getByRole("main")
      .getByRole("link", { name: "商品を登録する" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/food-products\/add/);
    await page.getByRole("link", { name: option }).click();
  };

  // 手動で入力して登録する
  await openRegistration(/手動で入力する/);
  await expect(page).toHaveURL(/\/food-products\/new/);
  await page.getByLabel("商品名").fill(`手動の商品-${suffix}`);
  await page.getByLabel("カロリー（kcal/100g）").fill("380");
  await page.getByLabel("内容量（g）").fill("500");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(listUrl);
  await page.goBack();
  await expect(page).toHaveURL(householdPage);

  // 共通のごはん商品から探して追加する（検索し直しても履歴を積まない）
  await openRegistration(/共通のごはん商品から探す/);
  await expect(page).toHaveURL(/\/food-products\/search/);
  await page.getByLabel("商品名・メーカー名").fill(productName);
  await page.getByRole("button", { name: "検索する" }).click();
  await expect(page).toHaveURL(/q=/);
  await page
    .getByRole("article", { name: productName })
    .getByRole("button", { name: `${productName}を追加する` })
    .click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByRole("article", { name: productName })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(householdPage);

  // 手動で入力するページからパンくずで登録方法を選び直しても、手動のページを履歴に残さない
  await openRegistration(/手動で入力する/);
  await expect(page).toHaveURL(/\/food-products\/new/);
  await page
    .getByRole("navigation", { name: "パンくずリスト" })
    .getByRole("link", { name: "登録する" })
    .click();
  await expect(page).toHaveURL(/\/food-products\/add/);
  await page.getByRole("link", { name: /共通のごはん商品から探す/ }).click();
  await page.getByLabel("商品名・メーカー名").fill(switchedProductName);
  await page.getByRole("button", { name: "検索する" }).click();
  await expect(page).toHaveURL(/q=/);
  await page
    .getByRole("article", { name: switchedProductName })
    .getByRole("button", { name: `${switchedProductName}を追加する` })
    .click();
  await expect(page).toHaveURL(listUrl);
  await page.goBack();
  await expect(page).toHaveURL(householdPage);
});
