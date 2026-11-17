import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallAppBanner } from "./InstallAppBanner";
import { INSTALL_BANNER_DISMISSED_STORAGE_KEY } from "./installBanner";
import { clearInstallPrompt } from "./installPromptStore";

const pathname = { current: "/cats" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

function stubUserAgent(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

function stubStandalone(standalone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: standalone && query === "(display-mode: standalone)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Chrome がインストールできると判断したときに発火するイベントを再現する */
function fireBeforeInstallPrompt() {
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt };
}

describe("InstallAppBanner", () => {
  beforeEach(() => {
    pathname.current = "/cats";
    window.localStorage.clear();
    stubStandalone(false);
  });

  afterEach(() => {
    act(() => {
      clearInstallPrompt();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("iOS では、追加方法のヘルプへのリンクを出す", async () => {
    stubUserAgent(IPHONE_UA);

    render(<InstallAppBanner />);

    const link = await screen.findByRole("link", { name: "追加方法" });
    expect(link).toHaveAttribute("href", "/help/add-to-home-screen");
  });

  it("Android では、押すとその場で追加の案内を出す", async () => {
    stubUserAgent(ANDROID_UA);
    render(<InstallAppBanner />);
    // 追加できるとわかるまでは出さない
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    const { prompt } = fireBeforeInstallPrompt();
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "追加する" }));
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("ホーム画面から開いているときは出さない", async () => {
    stubUserAgent(IPHONE_UA);
    stubStandalone(true);

    render(<InstallAppBanner />);
    fireBeforeInstallPrompt();

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("追加方法のヘルプでは出さない", () => {
    stubUserAgent(IPHONE_UA);
    pathname.current = "/help/add-to-home-screen";

    render(<InstallAppBanner />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("閉じると、次に開いたときも出さない", async () => {
    stubUserAgent(IPHONE_UA);
    const { unmount } = render(<InstallAppBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(INSTALL_BANNER_DISMISSED_STORAGE_KEY),
    ).not.toBeNull();

    unmount();
    render(<InstallAppBanner />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("iOS・Android 以外で追加できないブラウザでは出さない", () => {
    stubUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
    );

    render(<InstallAppBanner />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
