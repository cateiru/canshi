import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("見出しとトップページへのリンクを表示する", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "トップページへ戻る" }),
    ).toHaveAttribute("href", "/");
  });
});
