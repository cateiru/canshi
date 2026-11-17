import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpIndexPage from "./page";

// はじめてガイドのカードは、ログイン中かを調べる非同期のコンポーネントのため、ここでは描画しない
vi.mock("@/features/tour/presentation/TourStartCard", () => ({
  TourStartCard: () => null,
}));

describe("HelpIndexPage", () => {
  it("記事をカテゴリごとに表示する", () => {
    render(<HelpIndexPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "ヘルプ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "はじめに" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /家の作り方・家族の招待/ }),
    ).toHaveAttribute("href", "/help/create-household");
  });
});
