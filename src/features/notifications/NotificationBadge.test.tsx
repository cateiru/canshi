import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationBadge } from "./NotificationBadge";
import { countUnreadNotifications } from "./queries";

vi.mock("./queries", () => ({
  countUnreadNotifications: vi.fn(),
}));

describe("NotificationBadge", () => {
  it("未読が無い場合は aria-label が「通知」のままになる", async () => {
    vi.mocked(countUnreadNotifications).mockResolvedValue(0);

    render(await NotificationBadge());

    expect(screen.getByRole("link", { name: "通知" })).toBeInTheDocument();
  });

  it("未読件数を aria-label に含め、スクリーンリーダーからも件数がわかるようにする", async () => {
    vi.mocked(countUnreadNotifications).mockResolvedValue(3);

    render(await NotificationBadge());

    expect(
      screen.getByRole("link", { name: "通知、未読 3 件" }),
    ).toBeInTheDocument();
  });

  it("99件を超える場合は 99+ と表示しつつ、実際の件数を aria-label に含める", async () => {
    vi.mocked(countUnreadNotifications).mockResolvedValue(120);

    render(await NotificationBadge());

    expect(
      screen.getByRole("link", { name: "通知、未読 120 件" }),
    ).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
