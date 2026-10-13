import { defineConfig, devices } from "@playwright/test";

// 管理画面（packages/admin）のビジュアルリグレッションテスト (reg-suit)。`pnpm vrt:admin` で実行する。
// 管理画面はアプリ内で認証せず（Cloudflare Access に任せる）、next dev も使わないため、
// メインアプリの VRT（playwright.vrt.config.ts）の baseConfig は使わずに単独で設定する。
// 撮影結果は regconfig.admin.json で、メインアプリの VRT とは別に比較する
const PORT = 8788;

export default defineConfig({
  testDir: "./e2e-admin",
  testMatch: /vrt\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // e2e/vrt-snapshot.ts の書き出し先。regconfig.admin.json の core.actualDir と揃える
      metadata: { vrtActualDir: "vrt-screenshots/admin/actual" },
    },
  ],
  webServer: {
    command: `pnpm --filter @canshi/admin dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
