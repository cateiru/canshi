import { describe, expect, it } from "vitest";
import { hospitalVisitFormSchema } from "./schema";

const validInput = {
  symptomId: "",
  visitedDate: "2026-09-07",
  visitedTime: "10:00",
  reason: "定期検診",
  diagnosis: "",
  examinationResults: "",
  treatment: "",
  nextVisitDate: "",
  nextVisitTime: "",
  memo: "",
};

describe("hospitalVisitFormSchema", () => {
  it("受診日時と受診理由のみでも成功する", () => {
    const result = hospitalVisitFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("受診理由が空の場合は失敗する", () => {
    const result = hospitalVisitFormSchema.safeParse({
      ...validInput,
      reason: "",
    });
    expect(result.success).toBe(false);
  });
});
