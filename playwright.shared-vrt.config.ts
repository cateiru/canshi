import { defineConfig, devices } from "@playwright/test";

// 共通のパッケージ（packages/shared）のビジュアルリグレッションテスト (reg-suit)。
// `pnpm vrt:shared` で、Storybook をビルドしてから実行する。ビルド済みの Storybook
// （packages/shared/storybook-static）を配信してストーリーを撮るため、メインアプリの VRT
// （playwright.vrt.config.ts）の baseConfig（next dev・ログイン）は使わずに単独で設定する。
// 撮影結果は regconfig.shared.json で、メインアプリ・管理画面の VRT とは別に比較する
const PORT = 6007;

export default defineConfig({
  testDir: "./e2e-shared",
  testMatch: /vrt\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // 紙吹雪などの JavaScript のアニメーションを、端末で動きを減らす設定のときと同じく止める
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
      metadata: {
        // e2e/vrt-snapshot.ts の書き出し先。regconfig.shared.json の core.actualDir と揃える
        vrtActualDir: "vrt-screenshots/shared/actual",
        // Footer の部品そのものを撮るため、アプリのフッターを常にマスクする処理を外す
        vrtMaskFooter: false,
      },
    },
  ],
  webServer: {
    // ビルド済みの静的ファイルを配信するだけなので、vite preview を使う
    command: `pnpm --filter @canshi/shared exec vite preview --outDir storybook-static --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/iframe.html`,
    reuseExistingServer: !process.env.CI,
  },
});
