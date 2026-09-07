import { describe, expect, it } from "vitest";
import { medicationDoseFormSchema } from "./doseSchema";

const validInput = {
  occurredDate: "2026-09-07",
  occurredTime: "08:00",
  wasAdministered: "on",
  memo: "",
};

describe("medicationDoseFormSchema", () => {
  it("投薬できた場合は true になる", () => {
    const result = medicationDoseFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wasAdministered).toBe(true);
    }
  });

  it("チェックを外す（未送信）と false になる", () => {
    const result = medicationDoseFormSchema.safeParse({
      ...validInput,
      wasAdministered: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wasAdministered).toBe(false);
    }
  });
});
