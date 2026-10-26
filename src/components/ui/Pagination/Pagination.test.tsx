import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./Pagination";

const getHref = (page: number) => `/records?page=${page}`;

describe("Pagination", () => {
  it("前後のページへのリンクと現在のページを並べる", () => {
    render(<Pagination page={2} totalPages={3} getHref={getHref} />);

    const nav = screen.getByRole("navigation", { name: "ページ" });
    expect(nav).toHaveTextContent("2 / 3");
    expect(screen.getByRole("link", { name: "前のページ" })).toHaveAttribute(
      "href",
      "/records?page=1",
    );
    expect(screen.getByRole("link", { name: "次のページ" })).toHaveAttribute(
      "href",
      "/records?page=3",
    );
  });

  it("最初のページでは前のページへのリンクを出さない", () => {
    render(<Pagination page={1} totalPages={2} getHref={getHref} />);

    expect(screen.queryByRole("link", { name: "前のページ" })).toBeNull();
    expect(screen.getByRole("link", { name: "次のページ" })).toBeVisible();
  });

  it("最後のページでは次のページへのリンクを出さない", () => {
    render(<Pagination page={2} totalPages={2} getHref={getHref} />);

    expect(screen.getByRole("link", { name: "前のページ" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "次のページ" })).toBeNull();
  });

  it("1ページに収まる場合は何も表示しない", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} getHref={getHref} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
