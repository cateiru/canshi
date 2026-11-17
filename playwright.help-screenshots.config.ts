import { defineConfig } from "@playwright/test";
import {
  HELP_SCREENSHOT_SCALE,
  HELP_SCREENSHOT_VIEWPORT,
} from "./src/features/help/screenshots";

// ヘルプ（`/help/*`）に載せるスクリーンショットを撮る。`pnpm help:screenshots` で実行し、
// `public/images/help/` の画像を書き換える（e2e/help-screenshots.capture.ts）。
// テストではないため、通常の e2e・VRT からは実行しない（ファイル名を *.spec.ts にしていない）。
// ヘルプの画像はスマートフォンの画面を基準にする
export default defineConfig({
  testDir: "./e2e",
  testMatch: /help-screenshots\.capture\.ts$/,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    viewport: HELP_SCREENSHOT_VIEWPORT,
    deviceScaleFactor: HELP_SCREENSHOT_SCALE,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    colorScheme: "light",
    // 日付・時刻の入力欄の表示はブラウザの言語（Linux では環境変数 LANGUAGE）に従うため、
    // 日本語にする。LANG まで変えると、Linux では日本語のフォントの選ばれ方も変わってしまう
    launchOptions: {
      env: { ...process.env, LANGUAGE: "ja" },
    },
    actionTimeout: 15_000,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    // 起動済みの dev サーバーを使う場合は、下の環境変数を付けて起動しておくこと
    reuseExistingServer: true,
    env: {
      // 通知設定の画面で「この端末で通知を受け取る」を表示するための公開鍵。
      // 撮影では通知を購読しないため、実際の鍵でなくてよい
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "help-screenshots",
    },
  },
});
