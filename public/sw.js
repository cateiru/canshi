// キャッシュ構成を変更したら CACHE_VERSION を上げる。
// activate 時に古いバージョンのキャッシュをすべて破棄する。
const CACHE_VERSION = "v1";
const STATIC_CACHE = `canshi-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
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
      caches.match(request).then((cached) => {
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
