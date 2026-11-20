import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading } from "./Heading";

describe("Heading", () => {
  it("children を表示する", () => {
    render(<Heading>見出し</Heading>);
    expect(screen.getByText("見出し")).toBeInTheDocument();
  });

  it("level のデフォルトは 2", () => {
    render(<Heading>見出し</Heading>);
    expect(
      screen.getByRole("heading", { level: 2, name: "見出し" }),
    ).toBeInTheDocument();
  });

  it("level を指定すると対応する見出しタグになる", () => {
    render(<Heading level={1}>タイトル</Heading>);
    expect(
      screen.getByRole("heading", { level: 1, name: "タイトル" }),
    ).toBeInTheDocument();
  });
});
