import { describe, expect, it } from "vitest";
import { poopRecordFormSchema } from "./schema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
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
  it("すべての項目を入力すると成功する", () => {
    const result = poopRecordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasBlood).toBe(false);
      expect(result.data.hasForeignObject).toBe(true);
      expect(result.data.amount).toBe("ふつう");
    }
  });

  it("任意項目が未送信（null）でも必須項目のみで成功する", () => {
    const result = poopRecordFormSchema.safeParse({
      occurredDate: "2026-09-07",
      occurredTime: "08:00",
      amount: null,
      color: null,
      consistency: "normal",
      hasBlood: null,
      hasForeignObject: null,
      appetiteNote: null,
      energyNote: null,
      memo: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBeUndefined();
      expect(result.data.color).toBeUndefined();
      expect(result.data.hasBlood).toBe(false);
      expect(result.data.hasForeignObject).toBe(false);
      expect(result.data.appetiteNote).toBeUndefined();
      expect(result.data.energyNote).toBeUndefined();
      expect(result.data.memo).toBeUndefined();
    }
  });

  it("状態が不正な値の場合は失敗する", () => {
    const result = poopRecordFormSchema.safeParse({
      ...validInput,
      consistency: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
