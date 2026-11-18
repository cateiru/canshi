import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToast } from "@/components/ui";
import { HelpCodeBlock } from "./HelpCodeBlock";

vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  addToast: vi.fn(),
}));

const CODE = "https://example.com/mcp";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(writeText) },
    configurable: true,
  });
  return navigator.clipboard.writeText;
}

describe("HelpCodeBlock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(addToast).mockClear();
  });

  it("値を等幅のブロックで表示する", () => {
    render(<HelpCodeBlock code={CODE} />);

    expect(screen.getByText(CODE).closest("pre")).not.toBeNull();
  });

  it("コピーボタンで値をコピーし、しばらく「コピーしました」と示す", async () => {
    const writeText = mockClipboard(async () => {});
    render(<HelpCodeBlock code={CODE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "コピーする" }));
    });

    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(
      screen.getByRole("button", { name: "コピーしました" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("コピーしました");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(
      screen.getByRole("button", { name: "コピーする" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("コピーできなかったときは、エラーを知らせる", async () => {
    mockClipboard(async () => {
      throw new Error("denied");
    });
    render(<HelpCodeBlock code={CODE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "コピーする" }));
    });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: "error" }),
    );
    expect(
      screen.getByRole("button", { name: "コピーする" }),
    ).toBeInTheDocument();
  });
});
