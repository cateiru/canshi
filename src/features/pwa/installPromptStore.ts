import type { BeforeInstallPromptEvent } from "./installBanner";

// `beforeinstallprompt` はページを読み込んですぐに発火することがあり、React の useEffect で
// 受け取り始めると間に合わない。モジュールを読み込んだ時点（hydration より前）から受け取って保持する

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function start() {
  if (started || typeof window === "undefined") {
    return;
  }
  started = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // ブラウザの既定のインストールの案内を出さず、バナーのボタンから出す
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

start();

export function subscribeInstallPrompt(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function getServerInstallPrompt() {
  return null;
}

/** 一度使った `prompt()` は再び呼べないため、使い終わったら捨てる */
export function clearInstallPrompt() {
  deferredPrompt = null;
  notify();
}
