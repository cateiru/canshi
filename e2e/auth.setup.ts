import { execFileSync } from "node:child_process";
import { expect, test as setup } from "@playwright/test";
import { DEVELOPMENT_LOGIN_EMAIL } from "../src/features/auth/developmentLogin";

/** ログイン済みのセッション（Cookie）を保存するファイル。各テストはこれを読み込んで開始する */
export const AUTH_STORAGE_STATE = "e2e/.auth/user.json";

// すべてのページはログインが必要なため、テストの前に一度だけ `/login` でログインし、
// セッションを保存して各テストで使い回す（playwright.base.config.ts の `setup` プロジェクト）。
// e2e・VRT は `next dev` に対して実行するため、`/login` は開発用のログイン（メールアドレスの
// 入力だけでログインする。初期値は DEVELOPMENT_LOGIN_EMAIL）になる。VRT ではこのメール
// アドレスが VRT ユーザーに紐付いている（e2e/fixtures/vrt-seed.sql）。
// 猫の登録には家が必要なため、ログインしたユーザーの家を用意し、家に未所属の猫
// （前回までのテストで残った猫など）もその家に紐付ける
setup("ログインして家を用意する", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("メールアドレス（開発用）")).toHaveValue(
    DEVELOPMENT_LOGIN_EMAIL,
  );
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  // dev サーバーが同じローカル D1 を使っているため、書き込みが重なると SQLITE_BUSY で
  // 失敗することがある。スクリプトは何度実行しても同じ結果になるため、少し待ってやり直す
  await expect(async () => {
    execFileSync(
      "node",
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/link-household.mts",
        "--local",
        "--persist-to",
        ".wrangler/state",
        "--email",
        DEVELOPMENT_LOGIN_EMAIL,
        "--name",
        "E2Eの家",
      ],
      { stdio: "inherit" },
    );
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });

  await page.context().storageState({ path: AUTH_STORAGE_STATE });
});
