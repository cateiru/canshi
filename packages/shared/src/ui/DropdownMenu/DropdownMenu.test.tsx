import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./DropdownMenu";

const navigate = vi.fn();

const ITEMS = [
  { id: "cat", label: "猫を登録する", href: "/cats/new" },
  {
    id: "household",
    label: "家を作成する",
    href: "/settings/households/new?from=cats",
  },
];

describe("DropdownMenu", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("ボタンを押すまでメニューを開かない", () => {
    render(<DropdownMenu label="追加する" items={ITEMS} />);

    expect(screen.getByRole("button", { name: "追加する" })).toBeVisible();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("ボタンを押すとメニューを開き、選んだ項目のページへ navigate で移動する", () => {
    render(<DropdownMenu label="追加する" items={ITEMS} navigate={navigate} />);

    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(
      screen.getByRole("menuitem", { name: "猫を登録する" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("menuitem", { name: "家を作成する" }));
    expect(navigate).toHaveBeenCalledWith(
      "/settings/households/new?from=cats",
      undefined,
    );
  });

  it("href の無い項目を選ぶと、ページを移動せずに onAction をその項目の id で呼ぶ", () => {
    const onAction = vi.fn();
    render(
      <DropdownMenu
        label="追加する"
        aria-label="カリカリを追加する"
        items={[
          { id: "small", label: "14g/本" },
          { id: "large", label: "70g" },
        ]}
        onAction={onAction}
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "カリカリを追加する" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "70g" }));

    expect(onAction).toHaveBeenCalledWith("large");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("無効にするとボタンを押せない", () => {
    render(<DropdownMenu label="追加中..." items={ITEMS} isDisabled />);

    expect(screen.getByRole("button", { name: "追加中..." })).toBeDisabled();
  });
});
