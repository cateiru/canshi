import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddCatalogFoodProductButton } from "./AddCatalogFoodProductButton";
import type { AddCatalogFoodProductState } from "./actions";

// useSubmitActionState・DropdownMenu が使う App Router のフックをテスト用に差し替える
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function createAction() {
  return vi.fn(
    async (
      _state: AddCatalogFoodProductState,
      _formData: FormData,
    ): Promise<AddCatalogFoodProductState> => ({}),
  );
}

describe("AddCatalogFoodProductButton", () => {
  it("内容量の候補が複数あるときは、メニューで選んだ内容量で追加する", async () => {
    const action = createAction();
    render(
      <AddCatalogFoodProductButton
        action={action}
        householdId="household-1"
        returnToHousehold
        productName="ちゃおちゅーる"
        packageSizes={[
          { value: '[14,"本"]', label: "14g/本" },
          { value: "[70,null]", label: "70g" },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ちゃおちゅーるを追加する" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "70g" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("packageSize")).toBe("[70,null]");
    expect(formData.get("householdId")).toBe("household-1");
    expect(formData.get("returnToHousehold")).toBe("1");
  });

  it("内容量の候補が 1 つのときは、メニューを開かずにその内容量で追加する", async () => {
    const action = createAction();
    render(
      <AddCatalogFoodProductButton
        action={action}
        householdId="household-1"
        returnToHousehold={false}
        productName="カリカリ"
        packageSizes={[{ value: "[1500,null]", label: "1500g" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "カリカリを追加する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(action.mock.calls[0][1].get("packageSize")).toBe("[1500,null]");
  });

  it("追加できなかったときはエラーを表示する", async () => {
    const action = vi.fn(
      async (): Promise<AddCatalogFoodProductState> => ({
        error: "内容量を選び直してください",
      }),
    );
    render(
      <AddCatalogFoodProductButton
        action={action}
        householdId="household-1"
        returnToHousehold={false}
        productName="ちゃおちゅーる"
        packageSizes={[
          { value: '[14,"本"]', label: "14g/本" },
          { value: "[70,null]", label: "70g" },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ちゃおちゅーるを追加する" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "14g/本" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "内容量を選び直してください",
    );
  });
});
