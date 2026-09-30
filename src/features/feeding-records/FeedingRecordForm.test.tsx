import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FoodProduct } from "@/db/schema";
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
});
