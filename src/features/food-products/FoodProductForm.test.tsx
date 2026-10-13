import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "@/features/media/limits";
import type { FoodProductFormState } from "./actions";
import { FoodProductForm } from "./FoodProductForm";

// useMediaFormAction が使う App Router のフックをテスト用に差し替える
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

/** 送信できるよう必須項目を入力する */
function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("商品名"), {
    target: { value: "モンプチ" },
  });
  fireEvent.change(screen.getByLabelText("カロリー（kcal/100g）"), {
    target: { value: "380" },
  });
  fireEvent.change(screen.getByLabelText("内容量（g）"), {
    target: { value: "1500" },
  });
}

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
    fireEvent.change(screen.getByLabelText("単位（任意）"), {
      target: { value: "袋" },
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("モンプチ");
    expect(formData.get("kcalPer100g")).toBe("380");
    expect(formData.get("packageAmountG")).toBe("1500");
    expect(formData.get("packageUnit")).toBe("袋");
    expect(formData.get("nutritionType")).toBe("complete");
    expect(formData.get("textureType")).toBe("dry");
  });

  it("最初から選んでおく家を指定したときは、保存後に選んだ家の商品一覧へ移動する", async () => {
    const action = vi.fn(
      async (
        _state: FoodProductFormState,
        _formData: FormData,
      ): Promise<FoodProductFormState> => ({ savedRecordId: "product-1" }),
    );

    render(
      <FoodProductForm
        action={action}
        households={[{ id: "home", name: "わが家" }]}
        defaultHouseholdId="home"
        mediaLimits={DEFAULT_MEDIA_LIMITS}
        submitLabel="登録する"
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/food-products?householdId=home",
      ),
    );
  });

  it("最初から選んでおく家を指定しないときは、保存後に商品一覧へ移動する", async () => {
    const action = vi.fn(
      async (
        _state: FoodProductFormState,
        _formData: FormData,
      ): Promise<FoodProductFormState> => ({ savedRecordId: "product-1" }),
    );

    render(
      <FoodProductForm
        action={action}
        households={[{ id: "home", name: "わが家" }]}
        mediaLimits={DEFAULT_MEDIA_LIMITS}
        submitLabel="登録する"
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/food-products"),
    );
  });
});
