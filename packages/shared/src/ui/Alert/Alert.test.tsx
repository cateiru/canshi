import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./Alert";

describe("Alert", () => {
  it("children を role=alert として表示する", () => {
    render(<Alert>保存しました</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("保存しました");
  });

  it("color は輪郭色のクラスとして反映される", () => {
    render(<Alert color="error">失敗しました</Alert>);
    expect(screen.getByRole("alert").className).toMatch(/error/);
  });
});
