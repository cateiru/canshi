import { describe, expect, it } from "vitest";
import { symptomFormSchema } from "./schema";

const validInput = {
  symptomType: "嘔吐",
  onsetDate: "2026-09-07",
  onsetTime: "08:00",
  frequencyOrSeverity: "1日3回",
  appetiteNote: "",
  energyNote: "",
  status: "ongoing",
  memo: "",
};

describe("symptomFormSchema", () => {
  it("必須項目を満たせば成功する", () => {
    const result = symptomFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("症状の種類が空の場合は失敗する", () => {
    const result = symptomFormSchema.safeParse({
      ...validInput,
      symptomType: "",
    });
    expect(result.success).toBe(false);
  });

  it("状態が不正な値の場合は失敗する", () => {
    const result = symptomFormSchema.safeParse({
      ...validInput,
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
