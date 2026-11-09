import { expect, type Page, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

// 受診理由に「去勢」「避妊」を含む通院記録を追加すると、プロフィールの避妊・去勢を「済」にするかを聞く

/** 猫を登録し、詳細ページの URL を返す */
async function registerCat(page: Page, catName: string, sex: "オス" | "メス") {
  await page.goto("/cats/new");
  await page.getByLabel("名前").fill(catName);
  await page.getByLabel("性別").click();
  await page.getByRole("option", { name: sex }).click();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: catName })).toBeVisible();
  return page.url();
}

/**
 * 開いている通院記録の追加ページで記録する。同じ日の「病院」の支出記録との紐付けを聞かれないよう、
 * ほかのテストが支出を記録しない過去の日付で記録する
 */
async function submitVisit(page: Page, reason: string) {
  await fillAndKeep(page.getByLabel("受診日"), "2001-01-01");
  await page.getByLabel("受診理由").fill(reason);
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  await expect(
    page.getByRole("article", { name: reason }).first(),
  ).toBeVisible();
}

/** 通院記録の追加ページを直接開いて記録する */
async function recordVisit(page: Page, catUrl: string, reason: string) {
  await page.goto(`${catUrl}/hospital-visits/new`);
  await submitVisit(page, reason);
}

async function deleteCat(page: Page, catUrl: string, catName: string) {
  await page.goto(catUrl);
  await page.getByRole("button", { name: "削除する" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(catName);
  await dialog.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/cats$/);
}

test("去勢の通院記録を追加して「はい」を選ぶと、プロフィールの去勢が「済」になる", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;
  const catUrl = await registerCat(page, catName, "オス");

  // 猫の詳細 → 通院記録 → 記録する の順に開くと、保存後は一覧へ戻る。戻った一覧でも聞く
  await page.getByRole("link", { name: "通院記録" }).click();
  await page.getByRole("link", { name: "記録する", exact: true }).click();
  await expect(page).toHaveURL(/\/hospital-visits\/new$/);
  await submitVisit(page, "去勢手術");
  const dialog = page.getByRole("dialog", { name: "プロフィールの更新" });
  await expect(
    dialog.getByText(
      `去勢の通院記録が追加されましたが、${catName}ちゃんは去勢されましたか？`,
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "はい" }).click();
  await expect(dialog).toHaveCount(0);
  // 答えたら一覧の search を外す。一覧は履歴に 1 つだけ残り、戻ると猫の詳細になる
  await expect(page).toHaveURL(/\/hospital-visits$/);
  await page.goBack();
  await expect(page).toHaveURL(catUrl);

  await page.goto(`${catUrl}/edit`);
  await expect(
    page
      .getByRole("radiogroup", { name: "去勢", exact: true })
      .getByRole("radio", { name: "済" }),
  ).toBeChecked();

  // すでに「済」なら、去勢の通院記録を追加しても聞かない
  await recordVisit(page, catUrl, "去勢手術の抜糸");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await deleteCat(page, catUrl, catName);
});

test("避妊の通院記録を追加して「いいえ」を選ぶと、プロフィールは変えない", async ({
  page,
}) => {
  const catName = `テスト猫-${Date.now()}`;
  const catUrl = await registerCat(page, catName, "メス");

  // 避妊・去勢の言葉を含まない受診理由では聞かない
  await recordVisit(page, catUrl, "ワクチン接種");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await recordVisit(page, catUrl, "避妊手術の術前検査");
  const dialog = page.getByRole("dialog", { name: "プロフィールの更新" });
  await expect(
    dialog.getByText(
      `避妊の通院記録が追加されましたが、${catName}ちゃんは避妊されましたか？`,
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "いいえ" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/hospital-visits$/);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 編集で受診理由に避妊・去勢の言葉を足しても聞かない
  await page
    .getByRole("article", { name: "ワクチン接種" })
    .getByRole("link", { name: "編集する" })
    .click();
  await page.getByLabel("受診理由").fill("ワクチン接種と避妊の相談");
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(
    page.getByRole("article", { name: "ワクチン接種と避妊の相談" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/hospital-visits$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`${catUrl}/edit`);
  await expect(
    page
      .getByRole("radiogroup", { name: "避妊", exact: true })
      .getByRole("radio", { name: "済" }),
  ).not.toBeChecked();

  await deleteCat(page, catUrl, catName);
});
