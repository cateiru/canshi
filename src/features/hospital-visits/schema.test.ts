import { describe, expect, it } from "vitest";
import { hospitalVisitFormSchema } from "./schema";

const validInput = {
  symptomId: "",
  reservedDate: "",
  reservedTime: "",
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

  it("予約日だけ入力し予約時刻が空だと失敗する", () => {
    const result = hospitalVisitFormSchema.safeParse({
      ...validInput,
      reservedDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("予約日・予約時刻の両方を入力すれば成功する", () => {
    const result = hospitalVisitFormSchema.safeParse({
      ...validInput,
      reservedDate: "2026-09-01",
      reservedTime: "09:00",
    });
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
