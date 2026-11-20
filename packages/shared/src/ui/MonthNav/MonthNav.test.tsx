import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthNav } from "./MonthNav";

describe("MonthNav", () => {
  it("前後の月へのリンクと表示中の年月を並べる", () => {
    render(
      <MonthNav
        year={2026}
        month={9}
        prevHref="/timeline?ym=2026-08"
        nextHref="/timeline?ym=2026-10"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "表示する月" });
    expect(nav).toHaveTextContent("2026年9月");
    expect(screen.getByRole("link", { name: "前の月" })).toHaveAttribute(
      "href",
      "/timeline?ym=2026-08",
    );

    const next = screen.getByRole("link", { name: "次の月" });
    expect(next).toHaveAttribute("href", "/timeline?ym=2026-10");
    // 「次の月 >」のように、アイコンは文字の後ろに置く
    expect(next.lastChild?.nodeName).toBe("svg");
  });
});
