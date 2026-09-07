import { describe, expect, it } from "vitest";
import { vomitRecordFormSchema } from "./schema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
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
});
