import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "@/features/media/limits";
import type { FoodProductFormState } from "./actions";
import { FoodProductForm } from "./FoodProductForm";

// useMediaFormAction が使う App Router のフックをテスト用に差し替える
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("FoodProductForm", () => {
  it("送信時にテキスト・数値・区分（Select）の値がすべて FormData に含まれる", async () => {
    const action = vi.fn(
      async (
        _state: FoodProductFormState,
        _formData: FormData,
      ): Promise<FoodProductFormState> => ({}),
    );

    render(
      <FoodProductForm
        action={action}
        mediaLimits={DEFAULT_MEDIA_LIMITS}
        submitLabel="登録する"
      />,
    );

    fireEvent.change(screen.getByLabelText("商品名"), {
      target: { value: "モンプチ" },
    });
    fireEvent.change(screen.getByLabelText("カロリー（kcal/100g）"), {
      target: { value: "380" },
    });
    fireEvent.change(screen.getByLabelText("内容量（g）"), {
      target: { value: "1500" },
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("モンプチ");
    expect(formData.get("kcalPer100g")).toBe("380");
    expect(formData.get("packageAmountG")).toBe("1500");
    expect(formData.get("nutritionType")).toBe("complete");
    expect(formData.get("textureType")).toBe("dry");
  });
});
