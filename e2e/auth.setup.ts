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

  // dev サーバーが同じローカル D1 を使っているため、書き込みが重なると SQLITE_BUSY で
  // 失敗することがある。スクリプトは何度実行しても同じ結果になるため、少し待ってやり直す
  await expect(async () => {
    execFileSync(
      "node",
      [
        "scripts/link-household.mts",
        "--local",
        "--persist-to",
        ".wrangler/state",
        "--name",
        "E2Eの家",
      ],
      { stdio: "inherit" },
    );
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });

  await page.context().storageState({ path: AUTH_STORAGE_STATE });
});
