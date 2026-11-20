import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("children を表示する", () => {
    render(<Card>内容</Card>);
    expect(screen.getByText("内容")).toBeInTheDocument();
  });

  it("title を見出しとして表示する", () => {
    render(<Card title="見出し">内容</Card>);
    expect(
      screen.getByRole("heading", { level: 2, name: "見出し" }),
    ).toBeInTheDocument();
  });
});
