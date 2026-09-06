import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("children を表示する", () => {
    render(<Badge>済</Badge>);
    expect(screen.getByText("済")).toBeInTheDocument();
  });

  it("color は文字色・背景色ではなく輪郭色のクラスとして反映される", () => {
    render(<Badge color="error">未対応</Badge>);
    const badge = screen.getByText("未対応");
    expect(badge.className).toMatch(/error/);
    expect(badge).not.toHaveAttribute("style");
  });
});
