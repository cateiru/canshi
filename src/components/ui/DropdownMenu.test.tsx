import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./DropdownMenu";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("DropdownMenu", () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it("選んだ項目のページへ Next.js のルーターで移動する", () => {
    render(
      <DropdownMenu
        label="追加する"
        items={[{ id: "cat", label: "猫を登録する", href: "/cats/new" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "猫を登録する" }));

    expect(router.push).toHaveBeenCalledWith("/cats/new", undefined);
  });
});
