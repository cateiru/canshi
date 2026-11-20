import { fireEvent, render, screen } from "@testing-library/react";
import { TbPencil, TbTrash } from "react-icons/tb";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";
import { IconButtonLink } from "./IconButtonLink";

describe("IconButton", () => {
  it("aria-label をボタンの名前にし、アイコンは読み上げない", () => {
    render(<IconButton icon={TbTrash} aria-label="削除する" />);

    const button = screen.getByRole("button", { name: "削除する" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("title を指定すると、ボタンを包む要素に付ける", () => {
    render(<IconButton icon={TbTrash} aria-label="削除する" title="削除" />);

    const button = screen.getByRole("button", { name: "削除する" });
    expect(button).not.toHaveAttribute("title");
    expect(button.parentElement).toHaveAttribute("title", "削除");
  });

  it("押すと onPress が呼ばれる", () => {
    const onPress = vi.fn();
    render(
      <IconButton icon={TbTrash} aria-label="削除する" onPress={onPress} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe("IconButtonLink", () => {
  it("aria-label をリンクの名前にし、title と子要素も描画する", () => {
    render(
      <IconButtonLink
        href="/edit"
        icon={TbPencil}
        aria-label="編集する"
        title="編集"
      >
        <span>3</span>
      </IconButtonLink>,
    );

    const link = screen.getByRole("link", { name: "編集する" });
    expect(link).toHaveAttribute("href", "/edit");
    expect(link).toHaveAttribute("title", "編集");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveTextContent("3");
  });
});
