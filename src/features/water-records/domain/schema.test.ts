import { describe, expect, it } from "vitest";
import { waterRecordFormSchema } from "./schema";

const baseInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  measurementMethod: "scale",
  suppliedAmountMl: "200",
  hasSpill: undefined,
  wasWaterChanged: undefined,
};

describe("waterRecordFormSchema", () => {
  it("必須項目のみで成功する", () => {
    const result = waterRecordFormSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("残量が給水量以下であれば成功する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      remainingAmountMl: "50",
    });
    expect(result.success).toBe(true);
  });

  it("残量が給水量を超えると失敗する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      remainingAmountMl: "250",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.remainingAmountMl?.[0]).toBe(
        "残量は給水量以下の値を入力してください",
      );
    }
  });

  it("残量が0でも成功する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      remainingAmountMl: "0",
    });
    expect(result.success).toBe(true);
  });

  it("測定方法が未選択だと失敗する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      measurementMethod: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("給水量が0以下だと失敗する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      suppliedAmountMl: "0",
    });
    expect(result.success).toBe(false);
  });

  it("主観評価が未選択でも成功する", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      subjectiveAmount: "",
    });
    expect(result.success).toBe(true);
  });

  it("主観評価を選択できる", () => {
    const result = waterRecordFormSchema.safeParse({
      ...baseInput,
      subjectiveAmount: "more",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjectiveAmount).toBe("more");
    }
  });
});
