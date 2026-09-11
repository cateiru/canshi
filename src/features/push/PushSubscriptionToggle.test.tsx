import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeToPushAction = vi.fn().mockResolvedValue({});
const unsubscribeFromPushAction = vi.fn().mockResolvedValue({});

vi.mock("./subscriptionActions", () => ({
  subscribeToPushAction: (...args: unknown[]) => subscribeToPushAction(...args),
  unsubscribeFromPushAction: (...args: unknown[]) =>
    unsubscribeFromPushAction(...args),
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
});
