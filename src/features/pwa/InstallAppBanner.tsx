"use client";

import { AddToHomeScreenIcon } from "@canshi/shared/ui/RecordIcons";
import { ScaledIcon } from "@canshi/shared/ui/ScaledIcon";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TbChevronRight, TbX } from "react-icons/tb";
import { Button, ButtonLink, IconButton } from "@/components/ui";
import styles from "./InstallAppBanner.module.css";
import {
  ADD_TO_HOME_SCREEN_HELP_SLUG,
  INSTALL_BANNER_DISMISSED_STORAGE_KEY,
  isInstallBannerDismissed,
  isInstallBannerHiddenPath,
  isIos,
} from "./installBanner";
import {
  clearInstallPrompt,
  getInstallPrompt,
  getServerInstallPrompt,
  subscribeInstallPrompt,
} from "./installPromptStore";

/** ホーム画面から開いている（PWA として起動している）かどうか */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari 独自のプロパティ
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readDismissed(): boolean {
  try {
    return isInstallBannerDismissed(
      window.localStorage.getItem(INSTALL_BANNER_DISMISSED_STORAGE_KEY),
      Date.now(),
    );
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.localStorage.setItem(
      INSTALL_BANNER_DISMISSED_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // localStorage が使えないときは、このページを開いている間だけ閉じる
  }
}

type Environment = {
  /** ホーム画面から開いていない・閉じていないなど、バナーを出してよい状態か */
  eligible: boolean;
  ios: boolean;
};

/**
 * ホーム画面から開いていないときに、画面の下の中央に出す、ホーム画面への追加を勧めるバナー。
 * Android（`beforeinstallprompt` に対応したブラウザ）ではその場で追加の案内を出し、
 * iOS は自分で追加する必要があるため、追加方法のヘルプへ移動する
 */
export function InstallAppBanner() {
  const pathname = usePathname();
  const installPrompt = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPrompt,
    getServerInstallPrompt,
  );
  // サーバーでは端末の状態がわからないため、マウントしてから判定する
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const bannerRef = useRef<HTMLElement>(null);
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    setEnvironment({
      eligible: !isStandalone() && !readDismissed(),
      ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
    });
  }, []);

  const visible =
    environment?.eligible === true &&
    !isInstallBannerHiddenPath(pathname) &&
    (environment.ios || installPrompt !== null);

  // 固定表示のバナーがページの最後の内容（フッターや保存ボタン）を隠さないよう、
  // 同じ高さの余白をページの最後に空ける
  useEffect(() => {
    const banner = bannerRef.current;
    if (!visible || !banner) {
      setBannerHeight(0);
      return;
    }
    setBannerHeight(banner.offsetHeight);
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      setBannerHeight(banner.offsetHeight);
    });
    observer.observe(banner);
    return () => {
      observer.disconnect();
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  function dismiss() {
    saveDismissed();
    setEnvironment((current) =>
      current ? { ...current, eligible: false } : current,
    );
  }

  async function install() {
    if (!installPrompt) {
      return;
    }
    // prompt() は 1 つのイベントで 1 回しか呼べないため、結果によらず捨てる。
    // 追加しなかったときは、ブラウザが条件を満たしたときにもう一度イベントを発火する
    clearInstallPrompt();
    await installPrompt.prompt();
    await installPrompt.userChoice;
  }

  // Android など、その場で追加できるときはそちらを優先する
  const canPrompt = installPrompt !== null;

  return (
    <>
      <div
        className={styles.spacer}
        style={{ height: bannerHeight }}
        aria-hidden="true"
      />
      <aside
        ref={bannerRef}
        className={styles.banner}
        aria-label="ホーム画面への追加"
      >
        <ScaledIcon
          icon={AddToHomeScreenIcon}
          size={32}
          aria-hidden="true"
          className={styles.icon}
        />
        <div className={styles.text}>
          <p className={styles.title}>ホーム画面に追加しませんか？</p>
          <p className={styles.description}>
            アプリのようにすぐ開けて、通知も受け取れます。
          </p>
        </div>
        {canPrompt ? (
          <Button variant="primary" onPress={install} className={styles.action}>
            追加する
          </Button>
        ) : (
          <ButtonLink
            variant="primary"
            href={`/help/${ADD_TO_HOME_SCREEN_HELP_SLUG}`}
            rightIcon={TbChevronRight}
            className={styles.action}
          >
            追加方法
          </ButtonLink>
        )}
        <IconButton
          icon={TbX}
          aria-label="閉じる"
          onPress={dismiss}
          className={styles.close}
        />
      </aside>
    </>
  );
}
