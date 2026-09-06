import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("children を表示する", () => {
    render(<Button>送信</Button>);
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  it("type 属性のデフォルトは button", () => {
    render(<Button>送信</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("disabled を渡すと無効化される", () => {
    render(<Button disabled>送信</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
