// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * `public/sw.js` は素の JS ファイルでビルドパイプラインを通らないため、ソースを
 * そのまま `Function` に渡して実行し、`self`／`clients`／`caches`／`fetch` を
 * このテスト内で差し替えたスタブに束縛する
 */
function loadServiceWorker() {
  const source = readFileSync(
    path.resolve(__dirname, "../../public/sw.js"),
    "utf8",
  );
  const listeners = new Map<string, (event: unknown) => unknown>();
  const self = {
    location: { origin: "https://canshi.example.com" },
    addEventListener: (type: string, handler: (event: unknown) => unknown) => {
      listeners.set(type, handler);
    },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn() },
  };
  const clients = {
    matchAll: vi.fn(),
    openWindow: vi.fn(),
  };
  const cache = { addAll: vi.fn(), put: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn() };
  const fetch = vi.fn();

  const run = new Function("self", "clients", "caches", "fetch", source);
  run(self, clients, caches, fetch);

  return { listeners, clients, cache, fetch };
}

describe("sw.js install", () => {
  it("オフラインページの HTML と、そのページが読み込む CSS をキャッシュする", async () => {
    const { listeners, cache, fetch } = loadServiceWorker();
    const handler = listeners.get("install");
    if (!handler) {
      throw new Error("install リスナーが登録されていません");
    }
    const html = [
      "<!DOCTYPE html><html><head>",
      '<link rel="stylesheet" href="/_next/static/chunks/a.css" data-precedence="next"/>',
      '<link data-precedence="next" href="/_next/static/chunks/b.css?v=1&amp;x=2" rel="stylesheet">',
      // 重複・対象外のリンクは含めない
      '<link rel="stylesheet" href="/_next/static/chunks/a.css"/>',
      '<link rel="preload" href="/_next/static/chunks/c.js" as="script"/>',
      '<link rel="stylesheet" href="https://fonts.example.com/font.css"/>',
      '<link rel="icon" href="/icon.svg"/>',
      "</head><body><h1>オフラインです</h1></body></html>",
    ].join("");
    const response = new Response(html, { status: 200 });
    fetch.mockResolvedValue(response);

    let installing: Promise<unknown> | undefined;
    handler({
      waitUntil: (promise: Promise<unknown>) => {
        installing = promise;
      },
    });
    await installing;

    expect(fetch).toHaveBeenCalledWith("/offline", { cache: "reload" });
    expect(cache.addAll).toHaveBeenCalledWith([
      "/_next/static/chunks/a.css",
      "/_next/static/chunks/b.css?v=1&x=2",
    ]);
    expect(cache.put).toHaveBeenCalledWith("/offline", response);
    // CSS が揃ってから HTML を置く
    expect(cache.addAll.mock.invocationCallOrder[0]).toBeLessThan(
      cache.put.mock.invocationCallOrder[0],
    );
  });

  it("オフラインページを取得できなければ install を失敗させ、何もキャッシュしない", async () => {
    const { listeners, cache, fetch } = loadServiceWorker();
    const handler = listeners.get("install");
    if (!handler) {
      throw new Error("install リスナーが登録されていません");
    }
    fetch.mockResolvedValue(new Response("error", { status: 500 }));

    let installing: Promise<unknown> | undefined;
    handler({
      waitUntil: (promise: Promise<unknown>) => {
        installing = promise;
      },
    });

    await expect(installing).rejects.toThrow();
    expect(cache.addAll).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});

describe("sw.js notificationclick", () => {
  it("相対パスの notification.url を絶対 URL に正規化し、同じページを開いているクライアントをフォーカスする", async () => {
    const { listeners, clients } = loadServiceWorker();
    const handler = listeners.get("notificationclick");
    if (!handler) {
      throw new Error("notificationclick リスナーが登録されていません");
    }
    const client = {
      url: "https://canshi.example.com/cats/123",
      focus: vi.fn(),
    };
    clients.matchAll.mockResolvedValue([client]);

    const event = {
      notification: { close: vi.fn(), data: { url: "/cats/123" } },
      waitUntil: (promise: Promise<unknown>) => promise,
    };
    await handler(event);

    expect(client.focus).toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it("一致するクライアントが無ければ新しいウィンドウを開く", async () => {
    const { listeners, clients } = loadServiceWorker();
    const handler = listeners.get("notificationclick");
    if (!handler) {
      throw new Error("notificationclick リスナーが登録されていません");
    }
    const otherClient = {
      url: "https://canshi.example.com/cats/999",
      focus: vi.fn(),
    };
    clients.matchAll.mockResolvedValue([otherClient]);

    const event = {
      notification: { close: vi.fn(), data: { url: "/cats/123" } },
      waitUntil: (promise: Promise<unknown>) => promise,
    };
    await handler(event);

    expect(otherClient.focus).not.toHaveBeenCalled();
    expect(clients.openWindow).toHaveBeenCalledWith("/cats/123");
  });
});
