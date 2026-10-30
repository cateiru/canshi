import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeToPushAction = vi.fn().mockResolvedValue({});
const unsubscribeFromPushAction = vi.fn().mockResolvedValue({});
const requestTestPushAction = vi.fn();

vi.mock("./subscriptionActions", () => ({
  subscribeToPushAction: (...args: unknown[]) => subscribeToPushAction(...args),
  unsubscribeFromPushAction: (...args: unknown[]) =>
    unsubscribeFromPushAction(...args),
  requestTestPushAction: (...args: unknown[]) => requestTestPushAction(...args),
}));

async function loadComponent() {
  const mod = await import("./PushSubscriptionToggle");
  return mod.PushSubscriptionToggle;
}

describe("PushSubscriptionToggle", () => {
  beforeEach(() => {
    vi.resetModules();
    subscribeToPushAction.mockClear();
    unsubscribeFromPushAction.mockClear();
    requestTestPushAction.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // @ts-expect-error テスト用に差し替えたプロパティを消す
    delete navigator.serviceWorker;
    // @ts-expect-error テスト用に差し替えたプロパティを消す
    delete window.PushManager;
  });

  it("VAPID公開鍵が未設定の場合は未設定である旨を表示する", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    expect(
      await screen.findByText("Push 通知はこの環境では設定されていません"),
    ).toBeInTheDocument();
  });

  it("serviceWorker・PushManager 非対応環境では案内を表示する", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    expect(
      await screen.findByText("このブラウザは通知の購読に対応していません"),
    ).toBeInTheDocument();
  });

  it("iOS Safari をタブで開いている場合はホーム画面への追加を案内する", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubGlobal("PushManager", class {});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      configurable: true,
    });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    expect(
      await screen.findByText(
        "通知を受け取るには、ホーム画面に追加してから有効化してください",
      ),
    ).toBeInTheDocument();
  });

  it("対応環境では未購読状態でチェックボックスを表示し、有効化すると購読を登録する", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AAAA");
    vi.stubGlobal("PushManager", class {});
    const subscription = {
      endpoint: "https://push.example.com/subscription-1",
      toJSON: () => ({
        endpoint: "https://push.example.com/subscription-1",
        keys: { p256dh: "p256dh-value", auth: "auth-value" },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({ pushManager }) },
      configurable: true,
    });
    vi.stubGlobal("Notification", {
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    const checkbox = await screen.findByRole("checkbox", {
      name: "この端末で通知を受け取る",
    });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(subscribeToPushAction).toHaveBeenCalledWith({
      endpoint: "https://push.example.com/subscription-1",
      p256dh: "p256dh-value",
      auth: "auth-value",
      userAgent: expect.any(String),
    });
  });

  function stubSubscribedDevice() {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AAAA");
    vi.stubGlobal("PushManager", class {});
    const subscription = {
      endpoint: "https://push.example.com/subscription-1",
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(subscription),
          },
        }),
      },
      configurable: true,
    });
  }

  it("未購読の端末ではテスト通知のボタンを表示しない", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AAAA");
    vi.stubGlobal("PushManager", class {});
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
      configurable: true,
    });
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    await screen.findByRole("checkbox", { name: "この端末で通知を受け取る" });
    expect(
      screen.queryByRole("button", { name: "テスト通知を送る" }),
    ).not.toBeInTheDocument();
  });

  it("購読中の端末ではテスト通知を予約し、届く時刻を表示する", async () => {
    stubSubscribedDevice();
    const scheduledAt = new Date(2026, 9, 30, 12, 15);
    requestTestPushAction.mockResolvedValue({
      scheduledAt: scheduledAt.toISOString(),
    });
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    fireEvent.click(
      await screen.findByRole("button", { name: "テスト通知を送る" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "テスト通知を予約しました。12:15ごろにこの端末へ届きます",
    );
    expect(requestTestPushAction).toHaveBeenCalledWith(
      "https://push.example.com/subscription-1",
    );
  });

  it("テスト通知を予約できなかった場合はエラーを表示する", async () => {
    stubSubscribedDevice();
    requestTestPushAction.mockResolvedValue({
      error: "テスト通知の予約に失敗しました",
    });
    const PushSubscriptionToggle = await loadComponent();

    render(<PushSubscriptionToggle />);

    fireEvent.click(
      await screen.findByRole("button", { name: "テスト通知を送る" }),
    );

    expect(
      await screen.findByText("テスト通知の予約に失敗しました"),
    ).toBeInTheDocument();
  });
});
