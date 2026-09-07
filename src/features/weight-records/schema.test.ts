import { describe, expect, it } from "vitest";
import { weightRecordFormSchema } from "./schema";

const baseInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
};

describe("weightRecordFormSchema", () => {
  it("自動算出モードで人間込み体重・人間だけの体重があれば成功する", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "auto",
      combinedWeightKg: "65.2",
      humanWeightKg: "61",
    });
    expect(result.success).toBe(true);
  });

  it("自動算出モードで人間だけの体重が欠けていると失敗する", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "auto",
      combinedWeightKg: "65.2",
    });
    expect(result.success).toBe(false);
  });

  it("自動算出モードで人間込み体重が人間だけの体重以下だと失敗する", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "auto",
      combinedWeightKg: "60",
      humanWeightKg: "61",
    });
    expect(result.success).toBe(false);
  });

  it("直接入力モードで猫の体重があれば成功する", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "direct",
      catWeightKg: "4.2",
    });
    expect(result.success).toBe(true);
  });

  it("直接入力モードで猫の体重が欠けていると失敗する", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "direct",
    });
    expect(result.success).toBe(false);
  });

  it("直接入力モードで猫の体重が0以下の場合、範囲エラーのメッセージになる", () => {
    const result = weightRecordFormSchema.safeParse({
      ...baseInput,
      inputMethod: "direct",
      catWeightKg: "0",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.catWeightKg?.[0]).toBe(
        "猫の体重は0より大きい値を入力してください",
      );
    }
  });
});
