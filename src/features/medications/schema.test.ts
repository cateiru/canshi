import { describe, expect, it } from "vitest";
import { medicationFormSchema } from "./schema";

const validInput = {
  symptomId: "",
  name: "抗生剤",
  doseAmount: "1錠",
  dosesPerDay: "2",
  startDate: "2026-09-01",
  endDate: "2026-09-14",
};

describe("medicationFormSchema", () => {
  it("すべての項目が正しければ成功する", () => {
    const result = medicationFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.symptomId).toBeUndefined();
    }
  });

  it("終了予定日を省略しても成功する", () => {
    const result = medicationFormSchema.safeParse({
      ...validInput,
      endDate: "",
    });
    expect(result.success).toBe(true);
  });

  it("終了予定日が服用開始日より前だと失敗する", () => {
    const result = medicationFormSchema.safeParse({
      ...validInput,
      endDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("薬名が空の場合は失敗する", () => {
    const result = medicationFormSchema.safeParse({
      ...validInput,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("1日あたりの回数が未入力（空文字）の場合は必須エラーになる", () => {
    const result = medicationFormSchema.safeParse({
      ...validInput,
      dosesPerDay: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dosesPerDay?.[0]).toBe(
        "1日あたりの回数を入力してください",
      );
    }
  });
});
