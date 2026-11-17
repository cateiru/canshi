import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderHelpLink } from "./HeaderHelpLink";

const location = { pathname: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
}));

describe("HeaderHelpLink", () => {
  it("画面に対応する記事があれば、その記事へ進める", () => {
    location.pathname = "/cats/cat-1/poop-records";
    render(<HeaderHelpLink />);
    expect(
      screen.getByRole("link", { name: "この画面のヘルプ" }),
    ).toHaveAttribute("href", "/help/records/poop-records");
  });

  it("対応する記事がなければ、ヘルプの一覧へ進める", () => {
    location.pathname = "/settings";
    render(<HeaderHelpLink />);
    expect(screen.getByRole("link", { name: "ヘルプ" })).toHaveAttribute(
      "href",
      "/help",
    );
  });
});
