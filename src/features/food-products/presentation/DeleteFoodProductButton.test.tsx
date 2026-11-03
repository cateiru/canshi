import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteFoodProductButton } from "./DeleteFoodProductButton";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("DeleteFoodProductButton", () => {
  it("使われていない商品は、確認のうえ削除する", async () => {
    const action = vi.fn(async () => ({}));
    render(
      <DeleteFoodProductButton action={action} foodProductName="モンプチ" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    const dialog = screen.getByRole("dialog", { name: "商品の削除" });
    expect(dialog).toHaveTextContent(
      "「モンプチ」を削除しますか？この操作は取り消せません。",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("使われている商品は、削除できない理由だけを表示し、削除しない", () => {
    const action = vi.fn(async () => ({}));
    render(
      <DeleteFoodProductButton
        action={action}
        foodProductName="モンプチ"
        inUseMessage="この商品を使ったごはん記録があるため削除できません"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    const dialog = screen.getByRole("dialog", { name: "商品の削除" });
    expect(dialog).toHaveTextContent(
      "この商品を使ったごはん記録があるため削除できません。",
    );
    expect(dialog).not.toHaveTextContent("削除しますか");
    expect(
      within(dialog).queryByRole("button", { name: "削除する" }),
    ).toBeNull();

    fireEvent.click(within(dialog).getByText("閉じる"));
    expect(action).not.toHaveBeenCalled();
  });
});
