import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("バージョン表記が更新情報ページへのリンクになっている", () => {
    render(<Footer version="1.2.3" />);

    expect(screen.getByRole("link", { name: "v1.2.3" })).toHaveAttribute(
      "href",
      "/release-notes",
    );
  });

  it("cateiru.com へのリンク付きコピーライトを表示する", () => {
    render(<Footer version="1.2.3" />);

    expect(screen.getByText("© 2026", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "cateiru" })).toHaveAttribute(
      "href",
      "https://cateiru.com",
    );
  });
});
