import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FoodProduct } from "@/db/schema";
import type { FeedingPresetWithItems } from "@/features/feeding-presets/queries";
import type { FeedingRecordFormState } from "./actions";
import { FeedingRecordForm } from "./FeedingRecordForm";

// useSubmitActionState が使う App Router のフックをテスト用に差し替える
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function createFoodProduct(overrides: Partial<FoodProduct>): FoodProduct {
  return {
    id: "food-1",
    name: "ちゃおちゅーる",
    kcalPer100g: 40,
    packageAmountG: 14,
    packageUnit: "本",
    nutritionType: "general",
    textureType: "wet",
    createdAt: new Date("2026-09-30T00:00:00Z"),
    updatedAt: new Date("2026-09-30T00:00:00Z"),
    ...overrides,
  };
}

const action = vi.fn(async (): Promise<FeedingRecordFormState> => ({}));

describe("FeedingRecordForm", () => {
  it("選択中の商品の内容量を単位つきで表示する", () => {
    render(
      <FeedingRecordForm
        action={action}
        foodProducts={[createFoodProduct({})]}
        foodProductImageUrls={{}}
        recentlyUsedFoodProductIds={[]}
        presets={[]}
        submitLabel="記録する"
      />,
    );

    expect(screen.getByText("内容量: 14g/本")).toBeInTheDocument();
  });

  it("単位のない商品は商品全体の内容量を表示する", () => {
    render(
      <FeedingRecordForm
        action={action}
        foodProducts={[
          createFoodProduct({
            name: "カリカリ",
            packageAmountG: 1500,
            packageUnit: null,
          }),
        ]}
        foodProductImageUrls={{}}
        recentlyUsedFoodProductIds={[]}
        presets={[]}
        submitLabel="記録する"
      />,
    );

    expect(screen.getByText("内容量: 1500g")).toBeInTheDocument();
  });

  it("既定は厳格モードで、グラム単位の入力欄を表示する", () => {
    render(
      <FeedingRecordForm
        action={action}
        foodProducts={[createFoodProduct({})]}
        foodProductImageUrls={{}}
        recentlyUsedFoodProductIds={[]}
        presets={[]}
        submitLabel="記録する"
      />,
    );

    expect(screen.getByRole("radio", { name: "厳格モード" })).toBeChecked();
    expect(screen.getByLabelText(/与えた量（g）/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "「厳格モード」「あいまいモード」とは？",
      }),
    ).toHaveAttribute("href", "/help/feeding-modes");
  });

  it("あいまいモードに切り替えると、段階での入力欄に置き換わる", () => {
    const { container } = render(
      <FeedingRecordForm
        action={action}
        foodProducts={[createFoodProduct({})]}
        foodProductImageUrls={{}}
        recentlyUsedFoodProductIds={[]}
        presets={[]}
        submitLabel="記録する"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "あいまいモード" }));

    expect(screen.queryByLabelText(/与えた量（g）/)).not.toBeInTheDocument();
    const given = screen.getByRole("radiogroup", { name: "与えた量" });
    expect(within(given).getByRole("radio", { name: "普通" })).toBeChecked();
    const leftover = screen.getByRole("radiogroup", { name: "残した量" });
    expect(within(leftover).getByRole("radio", { name: "完食" })).toBeChecked();
    expect(
      container.querySelector<HTMLInputElement>('input[name="mode"]')?.value,
    ).toBe("approximate");
  });

  it("あいまいモードのプリセットを選ぶと、記録方法と与えた量の段階を反映する", () => {
    const preset: FeedingPresetWithItems = {
      id: "preset-1",
      name: "おやつ",
      mode: "approximate",
      items: [
        {
          id: "preset-item-1",
          foodProductId: "food-1",
          foodProductName: "ちゃおちゅーる",
          foodProductImageUrl: null,
          givenAmountG: null,
          givenAmountLevel: "more",
        },
      ],
    };
    render(
      <FeedingRecordForm
        action={action}
        foodProducts={[createFoodProduct({})]}
        foodProductImageUrls={{}}
        recentlyUsedFoodProductIds={[]}
        presets={[preset]}
        submitLabel="記録する"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "おやつ" }));

    expect(screen.getByRole("radio", { name: "あいまいモード" })).toBeChecked();
    const given = screen.getByRole("radiogroup", { name: "与えた量" });
    expect(within(given).getByRole("radio", { name: "多め" })).toBeChecked();
  });
});
