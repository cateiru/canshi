import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// 共通のごはん商品は管理画面（packages/admin）からしか登録できないため、ローカルの D1 に
// 直接追加する。dev サーバーと書き込みが重なると SQLITE_BUSY で失敗することがあるため、
// 少し待ってやり直す（e2e/auth.setup.ts と同じ）
async function insertCatalogFoodProduct(id: string, name: string) {
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
        `INSERT INTO catalog_food_products (id, name, manufacturer, kcal_per_100g, package_amount_g, package_unit, nutrition_type, texture_type, life_stages)
        VALUES ('${id}', '${name}', 'E2Eフーズ', 40, 14, '本', 'general', 'wet', '["senior"]')`,
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
  await insertCatalogFoodProduct(`e2e-catalog-${suffix}`, productName);

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
  await candidate
    .getByRole("button", { name: `${productName}を追加する` })
    .click();

  // 家のごはん商品一覧に、内容を写した商品が追加される
  await expect(page).toHaveURL(/\/food-products$/);
  const added = page.getByRole("article", { name: productName });
  await expect(added).toBeVisible();
  await expect(added).toContainText("E2Eフーズ");

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
