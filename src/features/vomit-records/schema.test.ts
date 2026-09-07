import { describe, expect, it } from "vitest";
import { vomitRecordFormSchema } from "./schema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  count: "1",
  amount: "少なめ",
  color: "黄色",
  hasBlood: "on",
  hasForeignObject: null,
  appetiteNote: "",
  energyNote: "",
  memo: "",
};

describe("vomitRecordFormSchema", () => {
  it("必須項目のみでも成功する", () => {
    const result = vomitRecordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasBlood).toBe(true);
      expect(result.data.hasForeignObject).toBe(false);
    }
  });

  it("回数が0以下の場合は失敗する", () => {
    const result = vomitRecordFormSchema.safeParse({
      ...validInput,
      count: "0",
    });
    expect(result.success).toBe(false);
  });

  it("回数が未入力（空文字）の場合は必須エラーになる", () => {
    const result = vomitRecordFormSchema.safeParse({
      ...validInput,
      count: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.count?.[0]).toBe(
        "回数を入力してください",
      );
    }
  });
});
