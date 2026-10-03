import { describe, expect, it } from "vitest";
import { feedingRecordFormSchema } from "./schema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  mode: "strict",
  items: [
    { foodProductId: "food-1", givenAmountG: "30", leftoverAmountG: "5" },
  ],
};

describe("feedingRecordFormSchema", () => {
  it("すべての項目が正しければ成功する", () => {
    const result = feedingRecordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("複数商品を渡しても成功する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      items: [
        { foodProductId: "food-1", givenAmountG: "30", leftoverAmountG: "5" },
        { foodProductId: "food-2", givenAmountG: "20", leftoverAmountG: "0" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("商品が1つも無い場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("商品が未選択の場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      items: [{ ...validInput.items[0], foodProductId: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("残した量が与えた量より多い場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      items: [
        { foodProductId: "food-1", givenAmountG: "10", leftoverAmountG: "20" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("記録時刻の形式が不正な場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      occurredTime: "25:00",
    });
    expect(result.success).toBe(false);
  });

  it("記録方法が未指定・不正な場合は失敗する", () => {
    expect(
      feedingRecordFormSchema.safeParse({ ...validInput, mode: null }).success,
    ).toBe(false);
    expect(
      feedingRecordFormSchema.safeParse({ ...validInput, mode: "other" })
        .success,
    ).toBe(false);
  });

  describe("あいまいモード", () => {
    const approximateInput = {
      occurredDate: "2026-09-07",
      occurredTime: "08:00",
      mode: "approximate",
      items: [
        {
          foodProductId: "food-1",
          givenAmountG: null,
          leftoverAmountG: null,
          givenAmountLevel: "normal",
          leftoverLevel: "little",
        },
      ],
    };

    it("段階での量を渡せば、グラム単位の量が無くても成功する", () => {
      const result = feedingRecordFormSchema.safeParse(approximateInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        occurredDate: "2026-09-07",
        occurredTime: "08:00",
        mode: "approximate",
        items: [
          {
            foodProductId: "food-1",
            givenAmountLevel: "normal",
            leftoverLevel: "little",
          },
        ],
      });
    });

    it("与えた量・残した量の段階が未選択・不正な場合は失敗する", () => {
      const result = feedingRecordFormSchema.safeParse({
        ...approximateInput,
        items: [
          {
            foodProductId: "food-1",
            givenAmountLevel: null,
            leftoverLevel: "all",
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path)).toEqual([
        ["items", 0, "givenAmountLevel"],
        ["items", 0, "leftoverLevel"],
      ]);
    });

    it("厳格モードではグラム単位の量が必須になる", () => {
      const result = feedingRecordFormSchema.safeParse({
        ...approximateInput,
        mode: "strict",
      });
      expect(result.success).toBe(false);
    });
  });
});
