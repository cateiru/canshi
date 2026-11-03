import { describe, expect, it } from "vitest";
import { cleaningRecordFormSchema } from "./recordSchema";

const baseInput = {
  performedDate: "2026-09-07",
  performedTime: "08:00",
};

describe("cleaningRecordFormSchema", () => {
  it("必須項目のみで成功する", () => {
    const result = cleaningRecordFormSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("実施時刻の形式が不正だと失敗する", () => {
    const result = cleaningRecordFormSchema.safeParse({
      ...baseInput,
      performedTime: "25:00",
    });
    expect(result.success).toBe(false);
  });
});
