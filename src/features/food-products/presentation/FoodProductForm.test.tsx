import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "@/features/media/domain/limits";
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
    fireEvent.change(screen.getByLabelText("メーカー名（任意）"), {
      target: { value: "ネスレ" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "成猫" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "シニア" }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "対象の猫種（任意）" }),
      {
        target: { value: "ペルシャ" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("モンプチ");
    expect(formData.get("kcalPer100g")).toBe("380");
    expect(formData.get("packageAmountG")).toBe("1500");
    expect(formData.get("packageUnit")).toBe("袋");
    expect(formData.get("nutritionType")).toBe("complete");
    expect(formData.get("textureType")).toBe("dry");
    expect(formData.get("manufacturer")).toBe("ネスレ");
    expect(formData.getAll("lifeStages")).toEqual(["adult", "senior"]);
    expect(formData.get("targetBreed")).toBe("ペルシャ");
    // 量の単位は既定で g
    expect(formData.get("amountUnit")).toBe("g");
  });

  it("量の単位に ml を選ぶと、カロリー・内容量の見出しを ml にして送る", async () => {
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

    fireEvent.click(
      screen.getByRole("radio", { name: "ml（スープ・ミルクなど）" }),
    );
    fireEvent.change(screen.getByLabelText("商品名"), {
      target: { value: "ねこのミルク" },
    });
    fireEvent.change(screen.getByLabelText("カロリー（kcal/100ml）"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("内容量（ml）"), {
      target: { value: "200" },
    });
    expect(screen.queryByLabelText("内容量（g）")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("amountUnit")).toBe("ml");
    expect(formData.get("kcalPer100g")).toBe("60");
    expect(formData.get("packageAmountG")).toBe("200");
  });

  it("編集では保存済みの量の単位を選んでおく", () => {
    render(
      <FoodProductForm
        action={vi.fn(async () => ({}))}
        foodProduct={{
          id: "product-1",
          householdId: "home",
          name: "ねこのミルク",
          manufacturer: null,
          amountUnit: "ml",
          kcalPer100g: 60,
          packageAmountG: 200,
          packageUnit: null,
          nutritionType: "general",
          textureType: "soup",
          lifeStages: [],
          targetBreed: null,
          catalogFoodProductId: null,
          createdAt: new Date("2026-11-01T00:00:00Z"),
          updatedAt: new Date("2026-11-01T00:00:00Z"),
        }}
        mediaLimits={DEFAULT_MEDIA_LIMITS}
        submitLabel="更新する"
      />,
    );

    expect(
      screen.getByRole("radio", { name: "ml（スープ・ミルクなど）" }),
    ).toBeChecked();
    expect(screen.getByLabelText("カロリー（kcal/100ml）")).toHaveValue(60);
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
