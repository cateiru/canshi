import { expect, type Page, test } from "@playwright/test";
import { fillAndKeep } from "./helpers";

// はじめてガイドは、はじめてログインしたユーザーに出るため、保存済みのセッションを使わず、
// 毎回新しいユーザーでログインする（`next dev` の `/login` は入力したメールアドレスでログインする）
test.use({ storageState: { cookies: [], origins: [] } });

function guideOf(page: Page) {
  return page.getByRole("region", { name: "はじめてガイド" });
}

/**
 * ガイドのパネルのボタンを押し、押したあとの表示になるまで待つ。
 * ハイドレーション前に押すと反応しないため、表示が変わるまで押し直す
 */
async function pressInGuide(page: Page, name: string, after: string) {
  const guide = guideOf(page);
  const button = guide.getByRole("button", { name, exact: true });
  await expect(async () => {
    if (await button.isVisible()) {
      await button.click();
    }
    await expect(guide.getByText(after)).toBeVisible({ timeout: 2000 });
  }).toPass();
}

async function loginAsNewUser(page: Page) {
  await page.goto("/login");
  await fillAndKeep(
    page.getByLabel("メールアドレス（開発用）"),
    `e2e-tour-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  );
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("はじめてログインすると、家の作成からごはんの時間・プリセットまで順に案内する", async ({
  page,
}) => {
  // 登録画面を 5 つ続けて開くため、`next dev` が各ページをはじめてコンパイルするときは時間がかかる
  test.slow();
  await loginAsNewUser(page);
  const guide = guideOf(page);

  // ステップ 1：家の作成。家がないうちはスキップできない
  await expect(guide.getByText("ステップ 1 / 4")).toBeVisible();
  await expect(
    guide.getByRole("heading", { name: "家を作成しましょう" }),
  ).toBeVisible();
  await expect(guide.getByRole("button", { name: "スキップする" })).toHaveCount(
    0,
  );

  await guide.getByRole("link", { name: "家の作成へ進む" }).click();
  await expect(page).toHaveURL(/\/settings\/households\/new$/);
  await expect(
    guide.getByText("家の名前を入力して「家を作成する」を押してください。"),
  ).toBeVisible();
  await fillAndKeep(
    page.getByRole("textbox", { name: "家の名前" }),
    "ガイドで作成した家",
  );
  await page.getByRole("button", { name: "家を作成する" }).click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  await expect(
    guide.getByRole("heading", { name: "家の準備ができました" }),
  ).toBeVisible();

  // ステップ 2：ねこの登録。登録画面へ移り、作成した家が選ばれている
  await pressInGuide(page, "次へ：ねこの登録", "ステップ 2 / 4");
  await expect(page).toHaveURL(/\/cats\/new\?householdId=/);

  // ステップ 3・4：登録せずにスキップできる
  await pressInGuide(page, "スキップする", "ステップ 3 / 4");
  await expect(page).toHaveURL(/\/food-products\/add\?householdId=/);
  await pressInGuide(page, "スキップする", "ステップ 4 / 4");
  await expect(page).toHaveURL(
    /\/settings\/households\/[^/]+\/feeding-schedules$/,
  );
  const checklist = guide.getByRole("listitem");
  await expect(
    guide.getByRole("link", { name: "ごはんプリセットを設定する" }),
  ).toHaveAttribute("href", /^\/feeding-presets\/new\?householdId=/);
  await expect(
    checklist.filter({ hasText: "ごはんの時間" }).getByText("（未登録）"),
  ).toBeAttached();

  // ごはんの時間を登録すると、チェックリストにチェックが付く
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(
    checklist.filter({ hasText: "ごはんの時間" }).getByText("（登録済み）"),
  ).toBeAttached();
  await expect(
    guide.getByRole("link", { name: "ごはんの時間を確認する" }),
  ).toBeVisible();

  // 完了の案内を閉じると、パネルが消える
  await pressInGuide(page, "ガイドを完了する", "準備ができました");
  await guide.getByRole("button", { name: "ガイドを閉じる" }).click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeHidden();
});

test("ガイドはいつでもやめられ、ヘルプから続きを再開できる", async ({
  page,
}) => {
  await loginAsNewUser(page);
  const guide = guideOf(page);

  // 家を作成したところでやめる
  await guide.getByRole("link", { name: "家の作成へ進む" }).click();
  await fillAndKeep(
    page.getByRole("textbox", { name: "家の名前" }),
    "ガイドを再開する家",
  );
  await page.getByRole("button", { name: "家を作成する" }).click();
  await expect(
    guide.getByRole("heading", { name: "家の準備ができました" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "ガイドをやめる" }).click();
  await expect(guide).toBeHidden();
  await expect(
    page.getByText(
      "はじめてガイドをやめました。ヘルプからいつでも再開できます。",
    ),
  ).toBeVisible();

  // ヘルプからはじめると、まだ登録していないねこの登録から再開する
  await page.goto("/help");
  await page.getByRole("button", { name: "ガイドをはじめる" }).click();
  await expect(page).toHaveURL(/\/cats\/new\?householdId=/);
  await expect(guide.getByText("ステップ 2 / 4")).toBeVisible();
  await expect(
    guide.getByText("名前などを入力して「登録する」を押してください。"),
  ).toBeVisible();
});
