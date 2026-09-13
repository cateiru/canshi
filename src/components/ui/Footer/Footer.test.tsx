import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import packageJson from "../../../../package.json";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("package.json のバージョンを表示する", () => {
    render(<Footer />);

    expect(screen.getByText(`v${packageJson.version}`)).toBeInTheDocument();
  });

  it("更新情報ページへのリンクを表示する", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "更新情報" })).toHaveAttribute(
      "href",
      "/release-notes",
    );
  });

  it("cateiru.com へのリンク付きコピーライトを表示する", () => {
    render(<Footer />);

    expect(screen.getByText("© 2026", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "cateiru" })).toHaveAttribute(
      "href",
      "https://cateiru.com",
    );
  });
});
