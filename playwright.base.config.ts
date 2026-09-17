import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

// 通常の e2e (playwright.config.ts) と VRT (playwright.vrt.config.ts) で共通の設定
export const baseConfig: PlaywrightTestConfig = {
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // next dev と Chromium を並列起動するとメモリ負荷が大きいため、CI では直列実行にする
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
};
