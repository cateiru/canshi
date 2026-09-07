import { describe, expect, it } from "vitest";
import { poopRecordFormSchema } from "./schema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  count: "1",
  amount: "ふつう",
  color: "茶色",
  consistency: "normal",
  hasBlood: null,
  hasForeignObject: "on",
  appetiteNote: "",
  energyNote: "",
  memo: "",
};

describe("poopRecordFormSchema", () => {
  it("必須項目のみでも成功する", () => {
    const result = poopRecordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasBlood).toBe(false);
      expect(result.data.hasForeignObject).toBe(true);
      expect(result.data.amount).toBe("ふつう");
    }
  });

  it("状態が不正な値の場合は失敗する", () => {
    const result = poopRecordFormSchema.safeParse({
      ...validInput,
      consistency: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("回数が0以下の場合は失敗する", () => {
    const result = poopRecordFormSchema.safeParse({
      ...validInput,
      count: "0",
    });
    expect(result.success).toBe(false);
  });
});
