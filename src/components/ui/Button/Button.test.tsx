import { render, screen } from "@testing-library/react";
import { TbChevronRight, TbPlus } from "react-icons/tb";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

describe("Button", () => {
  it("children を表示する", () => {
    render(<Button>送信</Button>);
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  it("type 属性のデフォルトは button", () => {
    render(<Button>送信</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("isDisabled を渡すと無効化される", () => {
    render(<Button isDisabled>送信</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("leftIcon・rightIcon を文字の前後に 18px で描画し、読み上げない", () => {
    render(
      <Button leftIcon={TbPlus} rightIcon={TbChevronRight}>
        追加
      </Button>,
    );

    const button = screen.getByRole("button", { name: "追加" });
    const [left, right] = button.querySelectorAll("svg");
    expect(button.firstChild).toBe(left);
    expect(button.lastChild).toBe(right);
    for (const icon of [left, right]) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("width", "18");
    }
  });

  it("children が関数でも leftIcon を描画する", () => {
    render(
      <Button leftIcon={TbPlus}>
        {({ isDisabled }) => (isDisabled ? "無効" : "追加")}
      </Button>,
    );

    const button = screen.getByRole("button", { name: "追加" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ButtonLink", () => {
  it("leftIcon を文字の前に描画する", () => {
    render(
      <ButtonLink href="/new" variant="primary" leftIcon={TbPlus}>
        記録する
      </ButtonLink>,
    );

    const link = screen.getByRole("link", { name: "記録する" });
    expect(link).toHaveAttribute("href", "/new");
    expect(link.firstChild).toBe(link.querySelector("svg"));
  });
});
