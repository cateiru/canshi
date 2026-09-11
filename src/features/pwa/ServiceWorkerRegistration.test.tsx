import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    // @ts-expect-error テスト用に serviceWorker を差し替えている
    delete navigator.serviceWorker;
  });

  it("本番環境では Service Worker を登録する", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledWith("/sw.js", {
      updateViaCache: "none",
    });
  });

  it("本番環境以外では Service Worker を登録しない", () => {
    vi.stubEnv("NODE_ENV", "test");
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);

    expect(register).not.toHaveBeenCalled();
  });
});
