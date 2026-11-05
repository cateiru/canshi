// キャッシュ構成を変更したら CACHE_VERSION を上げる。
// activate 時に古いバージョンのキャッシュをすべて破棄する。
// v2: オフラインページの HTML だけでなく、そのページが読み込む CSS もキャッシュするようにした
const CACHE_VERSION = "v2";
const STATIC_CACHE = `canshi-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

/**
 * HTML 中の `<link rel="stylesheet" href="...">` から、同一オリジンの
 * `/_next/static/` 配下の CSS の URL を取り出す。
 * Service Worker では DOMParser を使えないため、正規表現で属性を読む
 */
function extractStylesheetUrls(html) {
  const urls = new Set();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    if (!rel.toLowerCase().split(/\s+/).includes("stylesheet")) {
      continue;
    }
    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!href) {
      continue;
    }
    const url = new URL(href.replaceAll("&amp;", "&"), self.location.origin);
    if (
      url.origin === self.location.origin &&
      url.pathname.startsWith("/_next/static/")
    ) {
      urls.add(url.pathname + url.search);
    }
  }
  return [...urls];
}

/**
 * オフラインページを、表示に必要な CSS とあわせてキャッシュする。
 * HTML だけをキャッシュすると、オフライン時に CSS の取得が失敗して
 * スタイルが当たらない状態で表示されてしまう
 */
async function precacheOfflinePage() {
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${OFFLINE_URL}: ${response.status}`);
  }
  const html = await response.clone().text();
  // CSS を先にキャッシュし、揃ってから HTML を置く（片方だけ残らないようにする）
  await cache.addAll(extractStylesheetUrls(html));
  await cache.put(OFFLINE_URL, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 以外・他オリジンへのリクエストは素通しする（記録データの API は常に最新を表示するため）
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // ページ遷移はネットワーク優先。オフライン時のみフォールバックページを返す
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // ビルドごとにファイル名が変わる静的アセットのみキャッシュ優先で配信する
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      // ファイル名にハッシュが入っており内容が変わらないため、Vary は見ない。
      // install 時に `cache.addAll` で保存した CSS は、ブラウザが送る実際の
      // リクエストとヘッダー（Accept など）が異なるため
      caches.match(request, { ignoreVary: true }).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, responseToCache));
          }
          return response;
        });
      }),
    );
  }

  // それ以外（API・記録データを含むページ等）はキャッシュせず素通しする
});

// `29` の Web Push。通知本文は `src/features/notifications/messages.ts` が
// 生成した { title, body, url } を JSON でそのまま送っている（`src/features/push/sendPush.ts`）
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  // notification.url は `/cats/...` のような相対パスだが、WindowClient.url は絶対 URL
  // なので、比較の前に同じ形式へ正規化する
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
