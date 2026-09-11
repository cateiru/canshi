"use client";

import { useEffect } from "react";

/**
 * `next dev` では Service Worker が `/_next/static/` をキャッシュしてしまい
 * HMR の再ビルド結果が反映されなくなるため、本番ビルドでのみ登録する
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }, []);

  return null;
}
