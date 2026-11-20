"use client";

import {
  UNSTABLE_Toast as AriaToast,
  Button,
  Text,
  UNSTABLE_ToastContent as ToastContent,
  type ToastOptions,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import styles from "./Toast.module.css";

export type ToastColor = "info" | "success" | "warning" | "error";

export type ToastContentValue = {
  title: string;
  color?: ToastColor;
};

export const toastQueue = new ToastQueue<ToastContentValue>({
  maxVisibleToasts: 5,
});

export function addToast(content: ToastContentValue, options?: ToastOptions) {
  return toastQueue.add(content, { timeout: 5000, ...options });
}

/**
 * アプリ全体で 1 つだけマウントする、トースト通知の表示領域。
 */
export function ToastRegionRoot() {
  return (
    <ToastRegion queue={toastQueue} className={styles.region}>
      {({ toast }) => (
        <AriaToast
          toast={toast}
          className={`${styles.toast} ${styles[toast.content.color ?? "info"]}`}
        >
          <ToastContent className={styles.content}>
            <Text slot="title">{toast.content.title}</Text>
          </ToastContent>
          <Button slot="close" className={styles.close} aria-label="閉じる">
            ×
          </Button>
        </AriaToast>
      )}
    </ToastRegion>
  );
}
