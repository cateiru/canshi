import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HelpIndexPage from "./page";

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
