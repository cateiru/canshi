import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RequestCatalogFoodProductState } from "./actions";
import { RequestCatalogFoodProductButton } from "./RequestCatalogFoodProductButton";

function createAction(result: RequestCatalogFoodProductState) {
  return vi.fn(
    async (
      _state: RequestCatalogFoodProductState,
      _formData: FormData,
    ): Promise<RequestCatalogFoodProductState> => result,
  );
}

describe("RequestCatalogFoodProductButton", () => {
  it("検索条件を送ってリクエストし、リクエスト済みの案内に切り替える", async () => {
    const action = createAction({ isRequested: true });
    render(
      <RequestCatalogFoodProductButton
        action={action}
        searchQuery="q=%E3%81%BE%E3%81%90%E3%82%8D"
        isRequested={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "この条件でリクエストする" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("searchQuery")).toBe(
      "q=%E3%81%BE%E3%81%90%E3%82%8D",
    );
    expect(
      await screen.findByText(/この条件でリクエスト済みです/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("すでにリクエストしていれば、ボタンを表示しない", () => {
    render(
      <RequestCatalogFoodProductButton
        action={createAction({})}
        searchQuery="q=a"
        isRequested
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "この条件でリクエスト済みです",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("リクエストできなかったときは、理由を表示する", async () => {
    render(
      <RequestCatalogFoodProductButton
        action={createAction({ error: "上限に達しました" })}
        searchQuery="q=a"
        isRequested={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "この条件でリクエストする" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "上限に達しました",
    );
  });
});
