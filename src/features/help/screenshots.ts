/**
 * ヘルプに載せるスクリーンショット。スマートフォンの画面の大きさで撮り、
 * `public/images/help/<name>.webp` に置く。
 *
 * 画像は `pnpm help:screenshots`（`e2e/help-screenshots.spec.ts`）で撮り直せる。
 * 名前を追加・変更したときは、撮影のスクリプトにも同じ名前の撮影を追加すること
 * （`screenshots.test.ts` で、ここにある名前の画像がすべてあることを確かめている）
 */
export const HELP_SCREENSHOT_NAMES = [
  "cats-empty",
  "household-new",
  "household-detail",
  "household-invitation",
  "household-join",
  "welcome-modal",
  "welcome-invitation",
  "cat-new",
  "cat-detail",
  "food-product-add",
  "food-product-new",
  "feeding-schedules",
  "feeding-preset-new",
  "feeding-mode-strict",
  "feeding-mode-approximate",
  "record-list",
  "timeline",
  "record-feeding",
  "record-poop",
  "record-weight",
  "record-vomit",
  "record-water",
  "record-shampoo",
  "record-brushing",
  "record-cleaning",
  "record-symptoms",
  "record-medications",
  "record-hospital-visits",
  "record-expenses",
  "record-memo",
  "notification-settings",
  "cat-notification-settings",
  "login-appearance-link",
  "appearance-settings",
  "ai-consent",
  "install-banner-ios",
  "install-banner-android",
] as const;

export type HelpScreenshotName = (typeof HELP_SCREENSHOT_NAMES)[number];

/** 撮影する画面の大きさ（CSS ピクセル）。画像はこの 2 倍の解像度で保存する */
export const HELP_SCREENSHOT_VIEWPORT = { width: 390, height: 720 } as const;

export const HELP_SCREENSHOT_SCALE = 2;

export function helpScreenshotSrc(name: HelpScreenshotName) {
  return `/images/help/${name}.webp`;
}
