import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markNotificationsReadAction } from "./actions";
import { MarkNotificationsRead } from "./MarkNotificationsRead";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("./actions", () => ({
  markNotificationsReadAction: vi.fn(),
}));

describe("MarkNotificationsRead", () => {
  beforeEach(() => {
    vi.mocked(markNotificationsReadAction).mockReset();
    refresh.mockReset();
  });

  it("マウント後に既読化の Server Action を呼び、完了後に router.refresh() で表示を更新する", async () => {
    vi.mocked(markNotificationsReadAction).mockResolvedValue({});

    render(<MarkNotificationsRead ids={["n1", "n2"]} />);

    await waitFor(() => {
      expect(markNotificationsReadAction).toHaveBeenCalledWith(["n1", "n2"]);
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("未読の通知が無ければ Server Action を呼ばない", async () => {
    render(<MarkNotificationsRead ids={[]} />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(markNotificationsReadAction).not.toHaveBeenCalled();
  });

  it("同じ id の組で再レンダーしても、Server Action を重複して呼ばない", async () => {
    vi.mocked(markNotificationsReadAction).mockResolvedValue({});

    const { rerender } = render(<MarkNotificationsRead ids={["n1"]} />);
    await waitFor(() => {
      expect(markNotificationsReadAction).toHaveBeenCalledTimes(1);
    });

    rerender(<MarkNotificationsRead ids={["n1"]} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(markNotificationsReadAction).toHaveBeenCalledTimes(1);
  });
});
