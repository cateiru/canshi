"use client";

import { useEffect, useState } from "react";
import { Alert, Checkbox } from "@/components/ui";
import styles from "./PushSubscriptionToggle.module.css";
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "./subscriptionActions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type SupportState =
  | "checking"
  | "unsupported"
  | "ios-not-installed"
  | "unconfigured"
  | "ready";

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !("MSStream" in window);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari 独自のプロパティ
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function subscriptionToPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent,
  };
}

/**
 * この端末の Push 購読を登録・解除するトグル。`Notification.permission` と
 * PWA としての起動状態（`display-mode: standalone`）を見て、iOS Safari から
 * タブで開いている場合は購読できない旨を案内する
 */
export function PushSubscriptionToggle() {
  const [supportState, setSupportState] = useState<SupportState>("checking");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!VAPID_PUBLIC_KEY) {
        setSupportState("unconfigured");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setSupportState("unsupported");
        return;
      }
      if (isIosSafari() && !isStandalone()) {
        setSupportState("ios-not-installed");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (cancelled) {
        return;
      }
      setIsSubscribed(subscription != null);
      setSupportState("ready");
    }

    detect().catch(() => {
      if (!cancelled) {
        setSupportState("unsupported");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(nextEnabled: boolean) {
    if (!VAPID_PUBLIC_KEY) {
      return;
    }
    setError(null);
    setIsPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (nextEnabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError(
            "通知が許可されませんでした。ブラウザの設定から通知を許可してください",
          );
          return;
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const result = await subscribeToPushAction(
          subscriptionToPayload(subscription),
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        setIsSubscribed(true);
      } else {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          const result = await unsubscribeFromPushAction(endpoint);
          if (result.error) {
            setError(result.error);
            return;
          }
        }
        setIsSubscribed(false);
      }
    } catch {
      setError("通知の設定に失敗しました");
    } finally {
      setIsPending(false);
    }
  }

  if (supportState === "checking") {
    return null;
  }

  if (supportState === "unconfigured") {
    return (
      <Alert color="info">Push 通知はこの環境では設定されていません</Alert>
    );
  }

  if (supportState === "unsupported") {
    return (
      <Alert color="info">このブラウザは通知の購読に対応していません</Alert>
    );
  }

  if (supportState === "ios-not-installed") {
    return (
      <Alert color="info">
        通知を受け取るには、ホーム画面に追加してから有効化してください
      </Alert>
    );
  }

  return (
    <div className={styles.container}>
      <Checkbox
        isSelected={isSubscribed}
        isDisabled={isPending}
        onChange={handleChange}
      >
        この端末で通知を受け取る
      </Checkbox>
      {error ? <Alert color="error">{error}</Alert> : null}
    </div>
  );
}
