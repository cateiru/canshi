import { describe, expect, it } from "vitest";
import { feedingPresetFormSchema } from "./schema";

const validInput = {
  name: "朝ごはんセット",
  items: [
    { foodProductId: "food-1", givenAmountG: "40" },
    { foodProductId: "food-2", givenAmountG: "20" },
  ],
};

describe("feedingPresetFormSchema", () => {
  it("すべての項目が正しければ成功する", () => {
    const result = feedingPresetFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("プリセット名が空の場合は失敗する", () => {
    const result = feedingPresetFormSchema.safeParse({
      ...validInput,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("商品が1つも無い場合は失敗する", () => {
    const result = feedingPresetFormSchema.safeParse({
      ...validInput,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("商品が未選択の場合は失敗する", () => {
    const result = feedingPresetFormSchema.safeParse({
      ...validInput,
      items: [{ ...validInput.items[0], foodProductId: "" }],
    });
    expect(result.success).toBe(false);
  });
});
