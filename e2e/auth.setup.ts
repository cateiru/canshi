import { execFileSync } from "node:child_process";
import { expect, test as setup } from "@playwright/test";

/** ログイン済みのセッション（Cookie）を保存するファイル。各テストはこれを読み込んで開始する */
export const AUTH_STORAGE_STATE = "e2e/.auth/user.json";

// すべてのページはログインが必要なため、テストの前に一度だけ `/login` でログインし、
// セッションを保存して各テストで使い回す（playwright.base.config.ts の `setup` プロジェクト）。
// 猫の登録には家が必要なため、ログインしたユーザーの家を用意し、家に未所属の猫
// （前回までのテストで残った猫など）もその家に紐付ける
setup("ログインして家を用意する", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  execFileSync(
    "node",
    [
      "scripts/link-household.mjs",
      "--local",
      "--persist-to",
      ".wrangler/state",
      "--name",
      "E2Eの家",
    ],
    { stdio: "inherit" },
  );

  await page.context().storageState({ path: AUTH_STORAGE_STATE });
});
