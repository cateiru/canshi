import { describe, expect, it } from "vitest";
import { feedingRecordFormSchema } from "./schema";

const validInput = {
  foodProductId: "food-1",
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  givenAmountG: "30",
  leftoverAmountG: "5",
};

describe("feedingRecordFormSchema", () => {
  it("すべての項目が正しければ成功する", () => {
    const result = feedingRecordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("商品が未選択の場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      foodProductId: "",
    });
    expect(result.success).toBe(false);
  });

  it("残した量が与えた量より多い場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      givenAmountG: "10",
      leftoverAmountG: "20",
    });
    expect(result.success).toBe(false);
  });

  it("発生時刻の形式が不正な場合は失敗する", () => {
    const result = feedingRecordFormSchema.safeParse({
      ...validInput,
      occurredTime: "25:00",
    });
    expect(result.success).toBe(false);
  });
});
