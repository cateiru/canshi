import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./DropdownMenu";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

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
    router.push.mockClear();
  });

  it("ボタンを押すまでメニューを開かない", () => {
    render(<DropdownMenu label="追加する" items={ITEMS} />);

    expect(screen.getByRole("button", { name: "追加する" })).toBeVisible();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("ボタンを押すとメニューを開き、選んだ項目のページへ移動する", () => {
    render(<DropdownMenu label="追加する" items={ITEMS} />);

    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(
      screen.getByRole("menuitem", { name: "猫を登録する" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("menuitem", { name: "家を作成する" }));
    expect(router.push).toHaveBeenCalledWith(
      "/settings/households/new?from=cats",
      undefined,
    );
  });
});
