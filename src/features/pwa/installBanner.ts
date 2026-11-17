/** iOS でホーム画面に追加する方法を説明するヘルプの slug（`/help/<slug>`） */
export const ADD_TO_HOME_SCREEN_HELP_SLUG = "add-to-home-screen";

/** バナーを閉じた日時を残す localStorage のキー */
export const INSTALL_BANNER_DISMISSED_STORAGE_KEY =
  "canshi:install-banner-dismissed-at";

/** バナーを閉じてから、もう一度出すまでの期間 */
export const INSTALL_BANNER_DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Chrome などが、インストールできるときに発火する `beforeinstallprompt` のイベント。
 * 標準化されていないため TypeScript の型にない
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * iPhone・iPad かどうか。iPadOS 13 以降の Safari は Mac と同じ UA を返すため、
 * タッチに対応しているかでも見分ける
 */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return true;
  }
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * バナーを出さないページ。ヘルプの追加方法のページ（バナーの行き先）と、
 * AI のアプリから開く同意画面（ブラウザで開くことが前提）では出さない
 */
export function isInstallBannerHiddenPath(pathname: string): boolean {
  return (
    pathname === `/help/${ADD_TO_HOME_SCREEN_HELP_SLUG}` ||
    pathname === "/oauth" ||
    pathname.startsWith("/oauth/")
  );
}

/** 閉じた日時（ミリ秒の文字列）から、まだバナーを出さない期間の中かどうか */
export function isInstallBannerDismissed(
  dismissedAt: string | null,
  now: number,
): boolean {
  if (dismissedAt === null) {
    return false;
  }
  const time = Number(dismissedAt);
  if (!Number.isFinite(time)) {
    return false;
  }
  return now - time < INSTALL_BANNER_DISMISS_DURATION_MS;
}
