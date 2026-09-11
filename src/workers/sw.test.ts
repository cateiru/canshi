// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * `public/sw.js` は素の JS ファイルでビルドパイプラインを通らないため、ソースを
 * そのまま `Function` に渡して実行し、`self`／`clients`／`caches` をこのテスト内で
 * 差し替えたスタブに束縛する
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
  const caches = { open: vi.fn(), keys: vi.fn() };

  const run = new Function("self", "clients", "caches", source);
  run(self, clients, caches);

  return { listeners, clients };
}

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
