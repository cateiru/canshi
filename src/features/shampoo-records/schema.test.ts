import { describe, expect, it } from "vitest";
import { shampooRecordFormSchema } from "./schema";

const baseInput = {
  performedDate: "2026-09-07",
  performedTime: "08:00",
};

describe("shampooRecordFormSchema", () => {
  it("必須項目のみで成功する", () => {
    const result = shampooRecordFormSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("備考を入力できる", () => {
    const result = shampooRecordFormSchema.safeParse({
      ...baseInput,
      memo: "低刺激シャンプーを使用",
    });
    expect(result.success).toBe(true);
  });

  it("実施日の形式が不正だと失敗する", () => {
    const result = shampooRecordFormSchema.safeParse({
      ...baseInput,
      performedDate: "2026/09/07",
    });
    expect(result.success).toBe(false);
  });
});
